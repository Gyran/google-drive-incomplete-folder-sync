import { google } from 'googleapis';

import nodePath from 'node:path';
import fs from 'node:fs';
import prompts from 'prompts';

import config from './config.js';
import { delay, ensurePath, fsExists, readDirRecursive } from './utils.js';

const setupAuth = async () => {
  const oauth2Client = new google.auth.OAuth2(
    config.get('oauthClientId'),
    config.get('oauthClientSecret'),
    config.get('oauthRedirectUrl'),
  );

  oauth2Client.on('tokens', (tokens) => {
    config.set('tokens', tokens);
  });

  let tokens = config.get('tokens');
  if (!tokens) {
    const url = oauth2Client.generateAuthUrl({
      scope: ['https://www.googleapis.com/auth/drive'],
    });
    const promptsResponse = await prompts({
      type: 'text',
      name: 'code',
      message: url,
    });

    tokens = (await oauth2Client.getToken(promptsResponse.code)).tokens;
  }

  oauth2Client.setCredentials(tokens);

  google.options({
    auth: oauth2Client,
  });
};

const drive = google.drive({
  version: 'v3',
});

const listDriveFiles = async (folderFileId) => {
  const filesListResponse = await drive.files.list({
    fields:
      'files(id, name, mimeType, capabilities(canDownload, canListChildren))',
    q: `'${folderFileId}' in parents`,
  });

  return filesListResponse.data.files;
};

const downloadDriveFile = async (fileId, dataPath) => {
  const exists = fsExists(dataPath);
  if (exists) {
    // we already have the file, skip downloading it
    return;
  }

  const destinationStream = fs.createWriteStream(dataPath);
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    { responseType: 'stream' },
  );

  await response.data.pipe(destinationStream);
};
const syncDriveFolder = async (folderFileId, currentPath = '/') => {
  const dataPath = config.get('dataPath');

  await ensurePath(nodePath.join(dataPath, currentPath));

  const filesListResponse = await drive.files.list({
    fields:
      'files(id, name, mimeType, capabilities(canDownload, canListChildren))',
    q: `'${folderFileId}' in parents`,
  });

  if (filesListResponse.data.files) {
    for (const file of filesListResponse.data.files) {
      if (file.capabilities.canListChildren) {
        await syncDriveFolder(file.id, nodePath.join(currentPath, file.name));
      } else if (file.capabilities.canDownload) {
        await downloadDriveFile(
          file.id,
          nodePath.join(dataPath, currentPath, file.name),
        );
      }
    }
  }
};

const saveCurrentSyncState = async () => {
  const dataPath = config.get('dataPath');
  const state = {
    files: [],
    lastRun: new Date(),
  };

  try {
    const filesInDestination = await readDirRecursive(dataPath);
    state.files = filesInDestination;
  } catch (error) {}

  config.set('currentState', state);
};

const getDriveFileIdFromPath = async (drivePath, rootFolderFileId) => {
  const parts = drivePath.split('/');

  let parentFileId = rootFolderFileId;
  for (const part of parts) {
    if (part === '') {
      continue;
    }

    const files = await listDriveFiles(parentFileId);

    for (const file of files) {
      if (file.name === part) {
        parentFileId = file.id;
        break;
      }
    }
  }

  return parentFileId;
};

const deleteDriveFile = async (fileId) => {
  const a = await drive.files.delete({ fileId });
};

const removeDeletedFilesFromDrive = async () => {
  const dataPath = config.get('dataPath');
  const rootFolderFileId = config.get('rootFolder');
  const lastState = config.get('currentState');

  if (lastState && Array.isArray(lastState.files)) {
    for (const filePath of lastState.files) {
      const exists = await fsExists(filePath);

      if (!exists) {
        const drivePath = filePath.substr(dataPath.length);

        const fileId = await getDriveFileIdFromPath(
          drivePath,
          rootFolderFileId,
        );

        await deleteDriveFile(fileId);
      }
    }
  }
};

await setupAuth();

const intervalMs = config.get('syncIntervalMs');
const rootFolderId = config.get('rootFolder');

let loopRunning = true;
while (loopRunning) {
  console.log('start of loop');
  await removeDeletedFilesFromDrive();
  await syncDriveFolder(rootFolderId);
  await saveCurrentSyncState();

  await delay(intervalMs);
}

console.log('DONE!');
