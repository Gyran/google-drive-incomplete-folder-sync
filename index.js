#!/usr/bin/env node

import { google } from 'googleapis';

import nodePath from 'node:path';
import fs from 'node:fs';

import CONFIG from './src/config.js';
import {
  delay,
  ensurePath,
  fsExists,
  readDirRecursive,
  writeJSON,
  readJSON,
  prompt,
} from './src/utils.js';

const writeTokens = async (tokens) => {
  await writeJSON(nodePath.join(CONFIG.configPath, 'tokens.json'), tokens);
};
const readTokens = async () => {
  try {
    const tokens = await readJSON(
      nodePath.join(CONFIG.configPath, 'tokens.json'),
    );

    return tokens;
  } catch (error) {
    console.log('could not read tokens', error);
  }

  return undefined;
};

const readCurrentState = async () => {
  try {
    const state = await readJSON(
      nodePath.join(CONFIG.configPath, 'state.json'),
    );

    return state;
  } catch (error) {
    console.log('could not read state', error);
  }

  return undefined;
};
const writeCurrentState = async (state) => {
  await writeJSON(nodePath.join(CONFIG.configPath, 'state.json'), state);
};

const setupAuth = async () => {
  const oauth2Client = new google.auth.OAuth2(
    CONFIG.oauthClientId,
    CONFIG.oauthClientSecret,
    CONFIG.oauthRedirectUrl,
  );

  oauth2Client.on('tokens', (tokens) => {
    console.log('setting tokens!');
    writeTokens(tokens);
  });

  let tokens = await readTokens();
  if (!tokens) {
    const url = oauth2Client.generateAuthUrl({
      scope: ['https://www.googleapis.com/auth/drive'],
    });
    const code = await prompt(`${url}\nCode:`);
    tokens = (await oauth2Client.getToken(code)).tokens;
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
  const exists = await fsExists(dataPath);

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
  const dataPath = CONFIG.dataPath;

  await ensurePath(nodePath.join(dataPath, currentPath));

  const filesListResponse = await drive.files.list({
    fields:
      'files(id, name, mimeType, capabilities(canDownload, canListChildren))',
    q: `'${folderFileId}' in parents`,
  });

  if (filesListResponse.data.files) {
    for (const file of filesListResponse.data.files) {
      console.log('syncing file', file);

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
  const dataPath = CONFIG.dataPath;
  const state = {
    files: [],
    lastRun: new Date(),
  };

  try {
    const filesInDestination = await readDirRecursive(dataPath);
    state.files = filesInDestination;
  } catch (error) {
    console.log('failed to read datadir', dataPath);
    console.log('error', error);
  }

  console.log('saving current state', state);

  await writeCurrentState(state);
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
  await drive.files.delete({ fileId });
};

const removeDeletedFilesFromDrive = async () => {
  const dataPath = CONFIG.dataPath;
  const rootFolderFileId = CONFIG.rootFolder;
  const lastState = await readCurrentState();

  if (lastState && Array.isArray(lastState.files)) {
    for (const filePath of lastState.files) {
      const exists = await fsExists(filePath);

      if (!exists) {
        const drivePath = filePath.substr(dataPath.length);

        const fileId = await getDriveFileIdFromPath(
          drivePath,
          rootFolderFileId,
        );

        console.log('will delete drive file', fileId, drivePath);
        await deleteDriveFile(fileId);
      }
    }
  }
};

const handleExitSignal = (signal) => {
  console.log(`Received ${signal}, exiting`);
  process.exit(0);
};

process.on('SIGINT', handleExitSignal);
process.on('SIGTERM', handleExitSignal);

await ensurePath(CONFIG.configPath);
await ensurePath(CONFIG.dataPath);
await setupAuth();

const intervalMs = CONFIG.syncIntervalMs;
const rootFolderId = CONFIG.rootFolder;

console.log('Starting!');
let loopRunning = true;
while (loopRunning) {
  await removeDeletedFilesFromDrive();
  await syncDriveFolder(rootFolderId);
  await saveCurrentSyncState();

  console.log(`Waiting ${CONFIG.syncIntervalMs} ms for next loop`);
  await delay(intervalMs);
}

console.log('DONE!');
