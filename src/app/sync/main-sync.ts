import { alignMonitorsToHardware } from '@features/layout-editor/layout-gestures';
import { layoutGestureStores } from '@features/layout-editor/layout-gestures';
import { reaction, type IReactionDisposer, compareStructural } from 'mobx';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { logSettingsSnapshot } from './persistence';
import {
  createSaveHandle,
  hydrateFromDisk,
  readSettingsFile,
} from './persistence-sync';
import { setupDeviceBindings } from '@features/hotkey-bindings/bindings-sync';
import { listenSettingsActions, registerHotkeyReactions } from './hotkey-sync';
import { setupMainListeners } from './listeners';
import { registerChatReactions } from './chat-sync';
import { registerSaveReaction } from './save-sync';
import { registerTelemetrySettingsReaction } from './telemetry-settings-sync';
import { registerPitServiceMainReactions } from './pit-service-sync';
import { registerVoiceMainReactions } from './voice-sync';
import { overlayMonitorNames, syncOverlayWindows } from './overlay-windows';
import { registerRemotePublishing } from './remote-publish';
import { registerClientPublishing } from './client-publish';
import { registerTrackRotationOwnership } from './track-rotation-sync';
import {
  listMonitorBounds,
  resolveMonitorByName,
} from '@shared/api/overlay-resolution';
import { setUpFirstRun } from '@entities/layout/first-run';
import { watchMonitorArrangement } from './monitor-watch';
import type { SessionContext } from '@shared/contracts/widget-settings';
import type { MainRoot } from '@app/roots/main-root';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

/**
 * Session-driven layout auto-switch. `fireImmediately`, so it must run after
 * hydration and after `setUpFirstRun` — otherwise it resolves the session
 * context against an empty layout list.
 */
export const registerLayoutAutoSwitchReaction = (
  root: MainRoot
): IReactionDisposer =>
  reaction(
    () => ({
      isConnected: root.sim.isConnected,
      isOnTrack: root.player.isOnTrack,
      sessionType: root.session.currentSessionType,
      autoSwitchLayouts: root.appSettings.appSettings.autoSwitchLayouts,
      sessionLayouts: JSON.stringify(root.layouts.sessionLayouts),
    }),
    ({ isConnected, isOnTrack, sessionType, autoSwitchLayouts }) => {
      if (!autoSwitchLayouts) return;
      if (!isConnected) return;

      let context: SessionContext | null = null;

      if (!isOnTrack) {
        context = 'Garage';
      } else if (sessionType === 'Practice') {
        context = 'Practice';
      } else if (sessionType === 'Qualify') {
        context = 'Qualify';
      } else if (sessionType === 'Race') {
        context = 'Race';
      }

      if (!context) return;

      const layoutId = root.layouts.sessionLayouts?.[context];

      if (!layoutId) return;

      // The screen follows the session whatever the editor is doing: while it
      // is open this moves the live layout only, leaving the one being edited
      // where the user put it.
      root.layoutEditor.applySessionLayout(layoutId);
    },
    { fireImmediately: true }
  );

/**
 * Which overlay windows exist, and what they draw. Requires the monitors to be
 * aligned to hardware already — opening a window for a placeholder position
 * puts it on the wrong screen.
 */
const registerOverlayWindowReactions = (
  root: MainRoot
): IReactionDisposer[] => [
  reaction(
    // One overlay window per monitor that has widgets on it. Switching layouts,
    // adding or removing a monitor config, enabling a widget, dragging one to
    // another screen and entering drag mode all change that set.
    // A window opened here asks for its snapshot itself (`hello`).
    () => [root.layouts.liveLayoutId, overlayMonitorNames(root).join('|')],
    () => {
      void syncOverlayWindows(root);
    }
  ),
];

/** Input bindings, and the device polling their existence justifies. */
const registerBindingReactions = (root: MainRoot): IReactionDisposer[] => [
  // Reading wheels 125 times a second is only worth it while something consumes
  // the edges: a device binding exists, or the settings screen is waiting for a
  // button — to bind it, or to search by it.
  reaction(
    () => ({
      hasDeviceBindings: root.bindings.referencedDeviceIds.length > 0,
      isCapturing: root.bindingsUi.isCapturing,
      isSearchingByKey: root.bindingsUi.isSearchingByKey,
    }),
    ({ hasDeviceBindings, isCapturing, isSearchingByKey }) => {
      void root.deviceInput.setPollingEnabled(
        hasDeviceBindings || isCapturing || isSearchingByKey
      );
    },
    { fireImmediately: true, equals: compareStructural }
  ),
];

/**
 * Everything the main window owns: reading settings, opening overlay windows,
 * and every reaction that mirrors state to them or writes it back to disk.
 *
 * The startup order below is load-bearing and must not be rearranged — each
 * step's preconditions are documented on the function it calls.
 */
export const initMainSync = async (root: MainRoot) => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const { store, loaded } = await readSettingsFile();

      await hydrateFromDisk(root, loaded);

      // A file this build cannot bring to the current schema is left untouched:
      // no hydration, no default layout, no save reactions. Everything below
      // would otherwise overwrite it with defaults within a second, which is
      // the exact loss the check exists to prevent.
      if (root.appSettings.settingsLocked) {
        return () => {
          mainSyncInitPromise = null;
        };
      }

      // Reconcile the persisted login with what the credential store actually
      // holds. Must run after hydration: the store is constructed before
      // settings load, so checking any earlier gets overwritten by the stale
      // value from disk and the UI claims a signed-in session that is gone.
      void root.twitchAuth.syncLogin();

      // On the user's schedule, which only the loaded settings know.
      root.appUpdate.start();

      // Companion programs start once the list has been read from disk, and
      // are stopped by the backend on the way out - the window is already
      // gone by then, so nothing here can do it.
      void root.companionApps.launchOnStart();

      void setUpFirstRun({
        layoutRecords: root.layouts,
        widgetMap: root.liveWidgets,
        resolvePrimaryMonitor: () => resolveMonitorByName(null),
      });

      // Migrated layouts carry placeholder monitor positions — persisted
      // settings never recorded where the screens actually are. Nothing may
      // render or open a window before this lands them on the real desktop.
      alignMonitorsToHardware(
        layoutGestureStores(root),
        await listMonitorBounds()
      );

      const onSave = createSaveHandle(root, store);

      await onSave();

      // Before any overlay is opened: each one asks for its snapshot as it
      // starts, and a `hello` sent before main listens would go unanswered.
      const clientPublishing = await registerClientPublishing(root);

      await syncOverlayWindows(root);

      // Overlays that outlived a reload of this window never say hello again.
      void clientPublishing.publishAll();

      // Windows raises no event a Tauri app can subscribe to when displays are
      // rearranged, so the arrangement is polled while the app has focus.
      const stopMonitorWatch = watchMonitorArrangement(root, () => {
        void clientPublishing.publishAll();
        void onSave();
      });

      const [
        mainUnlistens,
        settingsActionUnlisten,
        deviceBindingUnlistens,
        trackRotationUnlisten,
        closeRequestedUnlisten,
      ] = await Promise.all([
        setupMainListeners(root),
        listenSettingsActions(root),
        setupDeviceBindings(root),
        registerTrackRotationOwnership(root),
        getCurrentWindow().onCloseRequested(async (event) => {
          event.preventDefault();

          try {
            // The settings save runs on a debounced reaction
            // (SAVE_DEBOUNCE_MS). Closing before that timer fires would
            // persist stale layout/widget state, so flush them here.
            // Before the settings are written and the window goes: the
            // programs the user asked to close with the app are still
            // reachable here, and the backend exit hook is too late for
            // one that needs a moment to shut down.
            const stillRunning = await root.companionApps.closeOnExit();

            if (stillRunning.length > 0) {
              console.warn(
                'Companion apps still running at exit:',
                stillRunning.join(', ')
              );
            }

            await onSave();
            await logSettingsSnapshot(root);
          } catch (error) {
            console.error('Failed to log settings snapshot on close:', error);
          } finally {
            cleanup();

            await getCurrentWindow().destroy();
          }
        }),
      ]);

      // Registration order matches the original single list: the
      // `fireImmediately` reactions (layout auto-switch, device polling, chat
      // connect, sim-armed pit order) run in this sequence at startup.
      const disposers = [
        registerSaveReaction(root, onSave),
        registerTelemetrySettingsReaction(root),
        registerLayoutAutoSwitchReaction(root),
        ...registerOverlayWindowReactions(root),
        ...registerBindingReactions(root),
        ...registerHotkeyReactions(root),
        ...registerChatReactions(root),
        ...registerPitServiceMainReactions(root),
        ...registerVoiceMainReactions(root),
      ];

      // Owns the remote server's lifetime, so it is torn down with the rest.
      const stopRemotePublishing = registerRemotePublishing(root);

      const cleanup = () => {
        stopMonitorWatch();
        stopRemotePublishing();
        clientPublishing.dispose();
        settingsActionUnlisten();
        trackRotationUnlisten();
        closeRequestedUnlisten();

        mainUnlistens.forEach((u) => u());
        deviceBindingUnlistens.forEach((u) => u());
        disposers.forEach((d) => d());

        mainSyncInitPromise = null;
      };

      return cleanup;
    })();
  }

  const realCleanup = await mainSyncInitPromise;

  return () => {
    mainSyncRefCount--;

    if (mainSyncRefCount === 0) {
      realCleanup();
    }
  };
};
