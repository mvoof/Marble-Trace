import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * The user's own steering-wheel pictures, kept as files beside settings.json
 * (`…/com.voof.marble-trace/wheels/<sha256>.webp`); the widget's settings hold
 * only the file name. The asset protocol scope in `tauri.conf.json` opens this
 * one directory to the webviews.
 */
const WHEELS_DIR = 'wheels';

/**
 * Writes an already shrunk picture and returns its file name. The name is the
 * content's hash, so uploading the same picture twice keeps one file, and a
 * file another layout still points at is never overwritten with something else.
 */
export const saveWheelImage = async (
  bytes: Uint8Array<ArrayBuffer>,
  extension: string
): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const name = `${hash}.${extension}`;
  const path = `${WHEELS_DIR}/${name}`;

  await mkdir(WHEELS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });

  if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) {
    await writeFile(path, bytes, { baseDir: BaseDirectory.AppData });
  }

  return name;
};

/**
 * The URL a webview loads the picture from, or `null` where there is no Tauri
 * behind the page — a remote screen in a browser cannot reach the app's files.
 */
export const resolveWheelImageSrc = async (
  name: string
): Promise<string | null> => {
  try {
    return convertFileSrc(await join(await appDataDir(), WHEELS_DIR, name));
  } catch {
    return null;
  }
};
