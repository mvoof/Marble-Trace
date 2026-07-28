import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';

export const OVERLAY_LABEL_PREFIX = 'overlay-';

// Tauri window labels only accept alphanumerics plus -/:_ — monitor names come
// from the OS and can carry anything else.
const LABEL_UNSAFE = /[^a-zA-Z0-9\-_]/g;

export const monitorLabel = (monitorName: string): string =>
  `${OVERLAY_LABEL_PREFIX}${monitorName.replace(LABEL_UNSAFE, '_')}`;

// Open overlay windows keyed by the monitor name they were created for. The
// monitor name is carried in the window URL rather than derived from the label,
// because slugging is lossy.
export const listOverlayWindowLabels = async (): Promise<string[]> => {
  const windows = await getAllWebviewWindows();

  return windows
    .map((window) => window.label)
    .filter((label) => label.startsWith(OVERLAY_LABEL_PREFIX));
};

export const hasOverlayWindows = async (): Promise<boolean> =>
  (await listOverlayWindowLabels()).length > 0;
