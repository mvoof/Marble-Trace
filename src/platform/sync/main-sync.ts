import { alignMonitorsToHardware } from '@store/settings/layout-gestures';
import { layoutGestureStores } from '@store/root-store-context';
import { comparer, reaction, type IReactionDisposer } from 'mobx';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { logSettingsSnapshot } from './persistence';
import {
  createSaveHandle,
  hydrateFromDisk,
  readSettingsFile,
} from './persistence-sync';
import { setupDeviceBindings } from '@store/hotkeys/bindings-sync';
import { listenSettingsActions, registerHotkeyReactions } from './hotkey-sync';
import { setupMainListeners } from './listeners';
import { registerChatReactions } from './chat-sync';
import { pitStrategyOf } from '@store/settings/app-settings.store';
import { registerPitServiceMainReactions } from './pit-service-sync';
import { overlayMonitorNames, syncOverlayWindows } from './overlay-windows';
import { registerRemotePublishing } from './remote-publish';
import { registerClientPublishing } from './client-publish';
import { registerTrackRotationOwnership } from './track-rotation-sync';
import { listMonitorBounds, resolveMonitorByName } from './overlay-resolution';
import { setUpFirstRun } from '@store/settings/first-run';
import { watchMonitorArrangement } from './monitor-watch';
import type { SessionContext } from '@/types/widget-settings';
import type { MainRoot } from '@store/main-root';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

/**
 * App settings the overlays read. They reach the overlays in the snapshot
 * (`client-publish.ts`); here they are only persisted. Requires a hydrated
 * settings store.
 */
const registerOverlayReadSaveReactions = (
  root: MainRoot,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  reaction(
    () => [
      root.appSettings.appSettings.hideAllWidgets,
      root.appSettings.appSettings.hideWidgetsWhenGameClosed,
      root.appSettings.appSettings.autoSwitchLayouts,
      root.appSettings.appSettings.language,
      JSON.stringify(root.layouts.sessionLayouts),
    ],
    () => {
      void onSave();
    },
    { equals: comparer.structural }
  ),
];

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

/** App settings that only need persisting — nothing mirrors them. */
const registerAppSettingsSaveReactions = (
  root: MainRoot,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  reaction(
    () => root.appSettings.appSettings.autoUpdate,
    () => {
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.startMinimized,
    () => {
      void onSave();
    }
  ),
  reaction(
    () => [
      root.appSettings.appSettings.editorShowGrid,
      root.appSettings.appSettings.editorSnapToGrid,
      root.appSettings.appSettings.editorGridSize,
    ],
    () => {
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.updateCheckInterval,
    () => {
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.lastUpdateCheck,
    () => {
      void onSave();
    }
  ),
  // The remote block is read by `registerRemotePublishing`, which restarts the
  // server on a change but never writes - without this the port, the token and
  // the rate survive only until the app is closed some way other than the
  // window's own close handler.
  reaction(
    () => [
      root.appSettings.appSettings.remoteEnabled,
      root.appSettings.appSettings.remotePort,
      root.appSettings.appSettings.remoteLan,
      root.appSettings.appSettings.remoteToken,
      root.appSettings.appSettings.remoteTelemetryHz,
    ],
    () => {
      void onSave();
    }
  ),
  // One counter covers adding, removing, renaming and every toggle on the
  // companion list - the entries are objects, and a reaction on the array
  // itself would not see a field change inside one.
  reaction(
    () => root.companionApps.revision,
    () => {
      void onSave();
    }
  ),
];

/**
 * Which overlay windows exist, and what they draw. Requires the monitors to be
 * aligned to hardware already — opening a window for a placeholder position
 * puts it on the wrong screen.
 */
const registerOverlayWindowReactions = (
  root: MainRoot,
  onSave: () => Promise<void>
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
  reaction(
    // Widgets-catalog (preview page) edits only touch the defaults store, which
    // no other reaction observes — without this they'd never be persisted and
    // would reset on restart.
    () => root.widgetDefaults.changeToken,
    () => {
      void onSave();
    },
    { delay: 500 }
  ),
  reaction(
    // Every settings write, main's own and an overlay's command alike, moves
    // the one token. Nothing is committed into the active layout first: the
    // edits were made on the layout's own widgets, so the debounce delays only
    // the write to disk.
    () => root.settingsMutations.changeToken,
    () => {
      void onSave();
    },
    { delay: 500 }
  ),
];

/** Input bindings, and the device polling their existence justifies. */
const registerBindingReactions = (
  root: MainRoot,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  // One binding registry, one dependency. The backend dispatcher gets the map
  // from `registerHotkeyReactions`.
  reaction(
    () => root.bindings.mutationId,
    () => {
      void onSave();
    }
  ),
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
    { fireImmediately: true, equals: comparer.structural }
  ),
];

/**
 * Units, the wheel and the pit strategy — read by the overlays through the
 * snapshot, persisted here.
 */
const registerDisplayPreferenceReactions = (
  root: MainRoot,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  reaction(
    () => [
      root.units.unitSystem,
      root.appSettings.appSettings.steeringLock,
      pitStrategyOf(root.appSettings.appSettings),
    ],
    () => {
      void onSave();
    },
    { equals: comparer.structural }
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
            // The layout commit and settings save both run on debounced
            // reactions (500ms). Closing before that timer fires would
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
        ...registerOverlayReadSaveReactions(root, onSave),
        registerLayoutAutoSwitchReaction(root),
        ...registerAppSettingsSaveReactions(root, onSave),
        ...registerOverlayWindowReactions(root, onSave),
        ...registerBindingReactions(root, onSave),
        ...registerHotkeyReactions(root),
        ...registerDisplayPreferenceReactions(root, onSave),
        ...registerChatReactions(root, onSave),
        ...registerPitServiceMainReactions(root),
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
