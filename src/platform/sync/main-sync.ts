import { comparer, reaction, type IReactionDisposer } from 'mobx';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { listenTo } from '@platform/services/events.service';
import { logSettingsSnapshot } from './persistence';
import {
  createSaveHandle,
  hydrateFromDisk,
  readSettingsFile,
} from './persistence-sync';
import {
  applyKeyboardBindings,
  cleanupKeyboardBindings,
} from '@store/hotkeys/binding-runner';
import { setupDeviceBindings } from '@store/hotkeys/bindings-sync';
import {
  emitDragMode,
  emitInteractMode,
  emitHideAllWidgets,
  emitHideWidgetsWhenGameClosed,
  emitSteeringLockChanged,
  emitUnitsChanged,
  emitLanguageChanged,
  emitStandingsClassIndex,
  emitActiveLayoutToOverlays,
  emitSessionLayoutsChanged,
  emitAutoSwitchLayoutsChanged,
  emitBindingsChanged,
} from '@platform/services/events.service';
import { setupMainListeners } from './listeners';
import type { MonitorWidgetsPayload } from '@platform/services/events.service';
import { registerChatReactions } from './chat-sync';
import {
  registerPitServiceAutoReactions,
  registerPitServiceMirrorReactions,
} from './pit-service-sync';
import { overlayMonitorNames, syncOverlayWindows } from './overlay-windows';
import { registerRemotePublishing } from './remote-publish';
import { listMonitorBounds } from './overlay-resolution';
import { watchMonitorArrangement } from './monitor-watch';
import type { SessionContext } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

/**
 * The active layout as the overlays need it. The emitter takes plain data rather
 * than the store, so the service layer stays free of store imports.
 */
const pushActiveLayout = (root: RootStore) =>
  emitActiveLayoutToOverlays(
    root.layouts.activeLayout?.monitors ?? [],
    root.widgetSettings.allWidgets
  );

/** Values the overlay windows mirror. Requires a hydrated settings store. */
const registerBroadcastReactions = (
  root: RootStore,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  reaction(
    () => root.appSettings.dragMode,
    (v) => {
      void emitDragMode(v);
    }
  ),
  reaction(
    () => root.appSettings.interactMode,
    (v) => {
      void emitInteractMode(v);
    }
  ),
  reaction(
    () => root.appSettings.appSettings.hideAllWidgets,
    (v) => {
      void emitHideAllWidgets(v);
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.hideWidgetsWhenGameClosed,
    (v) => {
      void emitHideWidgetsWhenGameClosed(v);
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.autoSwitchLayouts,
    (v) => {
      void emitAutoSwitchLayoutsChanged(v);
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.language,
    (v) => {
      void emitLanguageChanged(v);
      void onSave();
    }
  ),
  reaction(
    () => JSON.stringify(root.layouts.sessionLayouts),
    () => {
      void emitSessionLayoutsChanged(root.layouts.sessionLayouts);
      void onSave();
    }
  ),
];

/**
 * Session-driven layout auto-switch. `fireImmediately`, so it must run after
 * hydration and after `ensureDefaultLayout` — otherwise it resolves the session
 * context against an empty layout list.
 */
const registerLayoutAutoSwitchReaction = (root: RootStore): IReactionDisposer =>
  reaction(
    () => ({
      isConnected: root.sim.isConnected,
      isOnTrack: root.player.isOnTrack,
      sessionType: root.session.currentSessionType,
      autoSwitchLayouts: root.appSettings.appSettings.autoSwitchLayouts,
      sessionLayouts: JSON.stringify(root.layouts.sessionLayouts),
      // Tracked, not just read: closing the editor re-runs this and applies the
      // session change that was skipped while it was open.
      isEditorOpen:
        root.widgetSettings.layoutEditorOpen ||
        root.widgetSettings.editorPreviewMode,
    }),
    ({
      isConnected,
      isOnTrack,
      sessionType,
      autoSwitchLayouts,
      isEditorOpen,
    }) => {
      if (!autoSwitchLayouts) return;
      if (isEditorOpen) return;
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

      if (!layoutId || layoutId === root.layouts.activeLayoutId) return;

      if (root.layouts.byId(layoutId)) {
        root.widgetSettings.loadLayout(layoutId, { notify: true });
      }
    },
    { fireImmediately: true }
  );

/** App settings that only need persisting — nothing mirrors them. */
const registerAppSettingsSaveReactions = (
  root: RootStore,
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
  root: RootStore,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  reaction(
    // One overlay window per monitor that has widgets on it. Switching layouts,
    // adding or removing a monitor config, enabling a widget, dragging one to
    // another screen and entering drag mode all change that set.
    () => [
      root.layouts.activeLayoutId,
      overlayMonitorNames(root).join('|'),
      root.widgetSettings.editorPreviewMode,
    ],
    () => {
      // While the editor previews a layout that isn't the active one, the
      // overlay must keep showing the previously-active layout — both its
      // widgets and its set of monitor windows.
      if (root.widgetSettings.editorPreviewMode) return;

      void syncOverlayWindows(root).then(() => pushActiveLayout(root));
    }
  ),
  reaction(
    () => root.widgetSettings.changeToken,
    () => {
      if (!root.widgetSettings.editorPreviewMode) {
        void pushActiveLayout(root);
      }
    },
    { delay: 16 }
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
    // Save on local edits (changeToken) AND on edits synced in from the
    // overlay's F9 drag mode (syncToken). Only this reaction watches syncToken
    // — the emit reaction must not, or main↔overlay would loop.
    //
    // Nothing is committed into the active layout first: the edits were made on
    // the layout's own widgets, so the debounce delays only the write to disk.
    () => [root.widgetSettings.changeToken, root.widgetSettings.syncToken],
    () => {
      void onSave();
    },
    { delay: 500 }
  ),
];

/** Input bindings, and the device polling their existence justifies. */
const registerBindingReactions = (
  root: RootStore,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  // One binding registry, one dependency. Adding a bindable action is an entry
  // in ACTIONS and nothing else.
  reaction(
    () => root.bindings.mutationId,
    () => {
      void applyKeyboardBindings(root);
      // Overrides, not the effective map: the overlay layers the same registry
      // defaults underneath, so sending them would only make every default look
      // like a user choice on the other side.
      void emitBindingsChanged(root.bindings.overrides);
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

/** Units and steering lock — mirrored and persisted. */
const registerDisplayPreferenceReactions = (
  root: RootStore,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  reaction(
    () => root.units.unitSystem,
    (v) => {
      void emitUnitsChanged(v);
      void onSave();
    }
  ),
  reaction(
    () => root.appSettings.appSettings.steeringLock,
    (v) => {
      void emitSteeringLockChanged(v);
      void onSave();
    }
  ),
];

/**
 * Everything the main window owns: reading settings, opening overlay windows,
 * and every reaction that mirrors state to them or writes it back to disk.
 *
 * The startup order below is load-bearing and must not be rearranged — each
 * step's preconditions are documented on the function it calls.
 */
export const initMainSync = async (root: RootStore) => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const { store, loaded } = await readSettingsFile();

      await hydrateFromDisk(root, loaded, { backup: true });

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

      root.widgetSettings.ensureDefaultLayout();

      // Migrated layouts carry placeholder monitor positions — persisted
      // settings never recorded where the screens actually are. Nothing may
      // render or open a window before this lands them on the real desktop.
      root.widgetSettings.alignMonitorsToHardware(await listMonitorBounds());

      const onSave = createSaveHandle(root, store);

      await onSave();

      await syncOverlayWindows(root);

      // Windows raises no event a Tauri app can subscribe to when displays are
      // rearranged, so the arrangement is polled while the app has focus.
      const stopMonitorWatch = watchMonitorArrangement(root, () => {
        void pushActiveLayout(root);
        void onSave();
      });

      const [
        overlaySettingsUnlisten,
        mainUnlistens,
        ,
        deviceBindingUnlistens,
        closeRequestedUnlisten,
      ] = await Promise.all([
        listenTo<MonitorWidgetsPayload>('widget-settings-updated', (e) => {
          // An overlay window only ever speaks for the widgets on its own
          // screen; taking the rest of its list would overwrite the other
          // monitors with a stale copy.
          root.widgetSettings.applySettingsSyncForMonitor(
            e.payload.monitorName,
            e.payload.widgets
          );

          void onSave();
        }),
        setupMainListeners(root),
        applyKeyboardBindings(root),
        setupDeviceBindings(root),
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
        ...registerBroadcastReactions(root, onSave),
        registerLayoutAutoSwitchReaction(root),
        ...registerAppSettingsSaveReactions(root, onSave),
        ...registerOverlayWindowReactions(root, onSave),
        ...registerBindingReactions(root, onSave),
        ...registerDisplayPreferenceReactions(root, onSave),
        ...registerChatReactions(root, onSave),
        reaction(
          () => root.standingsWidget.activeClassIndex,
          (v) => {
            void emitStandingsClassIndex(v);
          }
        ),
        ...registerPitServiceMirrorReactions(root),
        ...registerPitServiceAutoReactions(root),
      ];

      // Owns the remote server's lifetime, so it is torn down with the rest.
      const stopRemotePublishing = registerRemotePublishing(root);

      const cleanup = () => {
        stopMonitorWatch();
        stopRemotePublishing();
        overlaySettingsUnlisten();
        closeRequestedUnlisten();

        mainUnlistens.forEach((u) => u());
        deviceBindingUnlistens.forEach((u) => u());
        disposers.forEach((d) => d());

        cleanupKeyboardBindings();

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
