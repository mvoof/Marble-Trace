import { getCurrentWindow } from '@tauri-apps/api/window';

export type StopWatching = () => void;

/**
 * Reports whether this window is minimized, now and whenever it changes.
 *
 * Minimize is the one visibility state worth acting on: Windows reports it
 * reliably (it is the same `WM_SIZE` edge WebView2's own `put_IsVisible` is
 * tied to), and it arrives as a resize event. Focus is deliberately not
 * watched — an overlay is unfocused for the entire session, which is exactly
 * when it must keep drawing.
 */
export const watchMinimized = async (
  onChange: (minimized: boolean) => void
): Promise<StopWatching> => {
  const currentWindow = getCurrentWindow();

  const report = async () => {
    try {
      onChange(await currentWindow.isMinimized());
    } catch (error) {
      console.error('[window-visibility.service] isMinimized failed:', error);
    }
  };

  const unlisten = await currentWindow.onResized(() => void report());

  await report();

  return unlisten;
};
