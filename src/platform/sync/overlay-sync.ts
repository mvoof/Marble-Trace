import { comparer, runInAction } from 'mobx';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import { emitToMain, listenToMain } from '@platform/services/events.service';
import { setupOverlayListeners } from './listeners';
import { applyClientSnapshot } from './client-sync';
import { initPerfRun } from './perf-run';
import type { OverlayRoot } from '@store/roots/overlay-root';
import type { SnapshotMessage } from '@/types/client-protocol';

/**
 * An overlay's snapshot: the client's (`applyClientSnapshot`), plus what only an
 * app window holds — the bindings it names in its banners, and the fields of
 * its own commands main has not handled yet, drawn over the snapshot again in
 * the same action so they never flicker back.
 */
export const applyOverlaySnapshot = (
  root: OverlayRoot,
  message: SnapshotMessage
) => {
  for (const refusal of message.rejected) {
    console.warn(
      `[overlay-sync] main refused command ${refusal.commandNo}: ${refusal.reason}`
    );
  }

  runInAction(() => {
    applyClientSnapshot(root, message.snapshot);

    if (
      !comparer.structural(root.bindings.overrides, message.snapshot.bindings)
    ) {
      root.bindings.applyBindings(message.snapshot.bindings);
    }

    root.settingsClient.acknowledge(message.lastHandledCommandNo);
  });
};

/**
 * The overlay's transport for the client of ADR-0007 (`client-sync.ts`): Tauri
 * events to and from main. It reads no settings file and writes none — main
 * holds the settings and sends this window a snapshot of its own monitor, on
 * `hello` and on every change. It never opens chat connections either.
 *
 * Order is load-bearing: the snapshot listener is subscribed before `hello`
 * goes out, so the answer cannot arrive unheard.
 */
export const initOverlaySync = async (root: OverlayRoot) => {
  const clientId = getCurrentWebviewWindow().label;

  root.settingsClient.connect(clientId);

  const unlistens = await setupOverlayListeners(root);

  unlistens.push(
    await listenToMain((message) => {
      if (message.clientId !== clientId) return;

      applyOverlaySnapshot(root, message);
    })
  );

  const stopPerfRun = await initPerfRun(root);

  await emitToMain({ kind: 'hello', clientId });

  return () => {
    unlistens.forEach((u) => u());
    stopPerfRun();
  };
};
