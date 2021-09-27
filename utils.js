import fsp from 'node:fs/promises';

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
