import {
  emit,
  emitTo,
  listen,
  type EventCallback,
  type UnlistenFn,
} from '@tauri-apps/api/event';

import { listOverlayWindowLabels } from '@store/sync/overlay-labels';

// Thin typed passthrough over the Tauri event bridge — the only module allowed
// to import @tauri-apps/api/event. Hot path: `sim://telemetry/bundle` handlers
// run through `listenTo`, so nothing here may allocate or copy per event.

export const listenTo = <PayloadType>(
  event: string,
  handler: EventCallback<PayloadType>
): Promise<UnlistenFn> => listen(event, handler);

export const emitToApp = (event: string, payload?: unknown): Promise<void> =>
  emit(event, payload);

export const emitToWindow = (
  label: string,
  event: string,
  payload?: unknown
): Promise<void> => emitTo(label, event, payload);

// Fan-out to every open overlay window. During startup the main window can
// react before any overlay exists, which makes Tauri log "event emitted but no
// listeners found"; overlays hydrate the same values from disk on their own
// boot, so skipping an emit before they are up is harmless.
export const emitToOverlays = async (event: string, payload: unknown) => {
  const labels = await listOverlayWindowLabels();

  for (const label of labels) {
    await emitTo(label, event, payload);
  }
};

export type { UnlistenFn };
