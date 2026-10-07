import { mkdir, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

/**
 * Writes a file the user is expected to keep, then shows it in the file
 * manager.
 *
 * Both callers produce something meant to be compared with a later run or
 * attached to a bug report, which rules out the clipboard and rules out a
 * browser download: the latter lands silently in whatever folder the webview
 * chose. Everything goes next to settings.json instead — the directory a user
 * is already pointed at when reporting a problem — and the reveal is what makes
 * the file findable at all.
 */
export const saveTextFileAndReveal = async (
  directory: string,
  fileName: string,
  contents: string
): Promise<string> => {
  await mkdir(directory, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  await writeTextFile(`${directory}/${fileName}`, contents, {
    baseDir: BaseDirectory.AppData,
  });

  const fullPath = await join(await appDataDir(), directory, fileName);

  await revealItemInDir(fullPath);

  return fullPath;
};

const STAMP_PAD = 2;

const pad = (value: number): string => String(value).padStart(STAMP_PAD, '0');

/**
 * `2026-08-18_01-25` — sorts chronologically and is safe on every filesystem.
 * Local time, not UTC: the user looks for the file by when they saved it, and
 * a run made at 01:25 filed under 20-25 is one they cannot find.
 */
export const fileStamp = (): string => {
  const now = new Date();

  return [
    now.getFullYear(),
    '-',
    pad(now.getMonth() + 1),
    '-',
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    '-',
    pad(now.getMinutes()),
  ].join('');
};
