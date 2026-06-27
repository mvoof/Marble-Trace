import {
  writeFile,
  mkdir,
  remove,
  exists,
  BaseDirectory,
  readFile,
} from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

// Layout editor background images are stored as files under the app data dir
// (…/com.voof.marble-trace/backgrounds/<layoutId>.<ext>) and the layout keeps
// only the file name — so settings.json stays small even with large cockpit
// screenshots. Legacy values stored as data: URLs are still rendered as-is.
const BACKGROUNDS_DIR = 'backgrounds';

const isDataUrl = (value: string) => value.startsWith('data:');

export const saveBackgroundImage = async (
  layoutId: string,
  bytes: Uint8Array,
  extension: string
): Promise<string> => {
  await mkdir(BACKGROUNDS_DIR, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  const fileName = `${layoutId}.${extension}`;

  await writeFile(`${BACKGROUNDS_DIR}/${fileName}`, bytes, {
    baseDir: BaseDirectory.AppData,
  });

  return fileName;
};

export const deleteBackgroundImage = async (
  fileName: string | undefined
): Promise<void> => {
  if (!fileName || isDataUrl(fileName)) {
    return;
  }

  try {
    const path = `${BACKGROUNDS_DIR}/${fileName}`;

    if (await exists(path, { baseDir: BaseDirectory.AppData })) {
      await remove(path, { baseDir: BaseDirectory.AppData });
    }
  } catch (error) {
    console.error('Failed to delete background image:', error);
  }
};

export const resolveBackgroundSrc = async (
  value: string | undefined
): Promise<string | undefined> => {
  if (!value) {
    return undefined;
  }

  if (isDataUrl(value)) {
    return value;
  }

  const absolutePath = await join(await appDataDir(), BACKGROUNDS_DIR, value);

  return convertFileSrc(absolutePath);
};

export const cloneBackgroundImage = async (
  oldFileName: string | undefined,
  newLayoutId: string
): Promise<string | undefined> => {
  if (!oldFileName) {
    return undefined;
  }

  if (oldFileName.startsWith('data:')) {
    return oldFileName;
  }

  try {
    const extension = (oldFileName.split('.').pop() ?? 'png').toLowerCase();
    const oldPath = `${BACKGROUNDS_DIR}/${oldFileName}`;

    if (await exists(oldPath, { baseDir: BaseDirectory.AppData })) {
      const bytes = await readFile(oldPath, { baseDir: BaseDirectory.AppData });
      const newFileName = `${newLayoutId}.${extension}`;

      await mkdir(BACKGROUNDS_DIR, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });

      await writeFile(`${BACKGROUNDS_DIR}/${newFileName}`, bytes, {
        baseDir: BaseDirectory.AppData,
      });

      return newFileName;
    }
  } catch (error) {
    console.error('Failed to clone background image:', error);
  }

  return undefined;
};
