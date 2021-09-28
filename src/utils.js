import fsp from 'node:fs/promises';
import nodePath from 'node:path';
import readline from 'node:readline';

export const delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const fsExists = async (path) => {
  try {
    await fsp.stat(path);
    return true;
  } catch (error) {
    return false;
  }
};

export const ensurePath = async (dest) => {
  try {
    await fsp.mkdir(dest, { recursive: true });
  } catch (error) {
    /* noop */
  }
};

export const readDirRecursive = async (path) => {
  let result = [];

  const items = await fsp.readdir(path);

  for (const item of items) {
    const itemPath = nodePath.join(path, item);
    const stat = await fsp.stat(itemPath);
    if (stat && stat.isDirectory()) {
      result = result.concat(await readDirRecursive(itemPath));
    } else {
      result.push(itemPath);
    }
  }

  return result;
};

export const readJSON = async (path) => {
  const json = JSON.parse(await fsp.readFile(path));

  return json;
};

export const writeJSON = async (path, data) => {
  await fsp.writeFile(path, JSON.stringify(data));
};

export const prompt = async (question) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${question} `, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
};
