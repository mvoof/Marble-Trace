import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';

const LAYOUT_FILE_FILTER = {
  name: 'Marble Trace layout',
  extensions: ['json'],
};

/** Asks for a layout file; null when the dialog is closed. */
export const pickLayoutFile = async (): Promise<string | null> => {
  const picked = await open({ multiple: false, filters: [LAYOUT_FILE_FILTER] });

  return typeof picked === 'string' ? picked : null;
};

/**
 * Reads a file the user picked. The dialog adds the picked path to the file
 * system's scope, so a file outside the app's folders is readable here.
 */
export const readLayoutFile = (path: string): Promise<string> =>
  readTextFile(path);
