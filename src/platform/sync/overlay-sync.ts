import { comparer, reaction, runInAction } from 'mobx';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import {
  emitToMain,
  emitWidgetSettingsToMain,
  listenToMain,
} from '@platform/services/events.service';
import { setupOverlayListeners } from './listeners';
import { initPerfRun } from './perf-run';
import type { OverlayRoot } from '@store/overlay-root';
import type { OverlaySnapshot } from '@/types/client-protocol';

/**
 * Installs main's snapshot of this overlay's monitor. It replaces what the
 * window held: the screen and its widgets, and every app-level value its
 * widgets read.
 *
 * Assigned directly, never through a setter: a setter is main's — it bumps
 * `changeToken`, and some reach the backend, which main has already told.
 */
export const applyOverlaySnapshot = (
  root: OverlayRoot,
  snapshot: OverlaySnapshot
) => {
  runInAction(() => {
    Object.assign(root.appSettings.appSettings, {
      hideAllWidgets: snapshot.hideAllWidgets,
      hideWidgetsWhenGameClosed: snapshot.hideWidgetsWhenGameClosed,
      steeringLock: snapshot.steeringLock,
      carLength: snapshot.carLength,
      interactHotkeyMode: snapshot.interactHotkeyMode,
      streamChatHideCommands: snapshot.streamChatHideCommands,
      streamChatIgnoredBots: snapshot.streamChatIgnoredBots,
      ...snapshot.pitStrategy,
    });

    root.appSettings.hidesOffTrack = snapshot.hidesOffTrack;
    root.appSettings.settingsLocked = snapshot.settingsLocked;
    root.units.setSystem(snapshot.units);

    if (!comparer.structural(root.bindings.overrides, snapshot.bindings)) {
      root.bindings.applyBindings(snapshot.bindings);
    }

    root.liveWidgets.applyClientScreen({
      layoutId: snapshot.layoutId,
      layoutName: snapshot.layoutName,
      monitor: snapshot.monitor,
      widgets: snapshot.widgets,
    });
  });

  // Switching the language reloads every translated string; done only when
  // it actually changed, not on every drag main reports.
  if (root.appSettings.appSettings.language !== snapshot.language) {
    root.appSettings.setLanguage(snapshot.language);
  }
};

/**
 * Everything an overlay window owns. It reads no settings file and writes
 * none: main holds the settings and sends this window a snapshot of its own
 * monitor, on `hello` and on every change (ADR-0007). It never opens chat
 * connections either.
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

      applyOverlaySnapshot(root, message.snapshot);
    })
  );

  const stopPerfRun = await initPerfRun(root);

  await emitToMain({ kind: 'hello', clientId });

  const disposers = [
    reaction(
      () => root.settingsMutations.changeToken,
      () => {
        const monitorName = root.liveWidgets.ownMonitorName;

        if (!monitorName) return;

        // Only what was edited here travels back. A drag reports one widget
        // instead of the whole layout, and a list this window never touched
        // can no longer overwrite the record main holds for it.
        const { widgets } = root.liveWidgets.drainTouchedWidgets();

        if (widgets.length === 0) return;

        void emitWidgetSettingsToMain({
          monitorName,
          widgets,
          layoutId: root.liveWidgets.syncedLayoutId,
        });
      },
      { delay: 100 }
    ),
  ];

  return () => {
    unlistens.forEach((u) => u());
    disposers.forEach((d) => d());
    stopPerfRun();
  };
};
