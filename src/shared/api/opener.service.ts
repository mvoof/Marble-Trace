import { openUrl } from '@tauri-apps/plugin-opener';

/** Opens a link in the user's own browser, outside the app. */
export const openExternalUrl = (url: string): Promise<void> => openUrl(url);
