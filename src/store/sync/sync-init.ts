import { comparer, reaction } from 'mobx';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { load } from '@tauri-apps/plugin-store';
import {
  backupSettingsFile,
  settingsFileExists,
  hydrateStores,
  saveSettings,
  logSettingsSnapshot,
  SETTINGS_FILE,
  Settings,
} from './persistence';
import { runMigrations } from '@store/settings-schema';
import type { MigrationResult } from '@store/settings-schema/types';
import {
  applyKeyboardBindings,
  cleanupKeyboardBindings,
} from '@store/hotkeys/binding-runner';
import { setupDeviceBindings } from '@store/hotkeys/bindings-sync';
import {
  setupMainListeners,
  setupOverlayListeners,
  emitDragMode,
  emitInteractMode,
  emitHideAllWidgets,
  emitHideWidgetsWhenGameClosed,
  emitSteeringLockChanged,
  emitUnitsChanged,
  emitLanguageChanged,
  emitStandingsClassIndex,
  emitActiveLayoutToOverlays,
  emitWidgetSettingsToMain,
  emitSessionLayoutsChanged,
  emitAutoSwitchLayoutsChanged,
  emitStreamChatFilters,
  emitStreamChatCleared,
  emitPitServiceAutoSuspended,
  emitBindingsChanged,
} from './events';
import type { MonitorWidgetsPayload } from './events';
import { overlayMonitorNames, syncOverlayWindows } from './overlay-windows';
import { listMonitorBounds } from './overlay-resolution';
import { watchMonitorArrangement } from './monitor-watch';
import type { SessionContext } from '@/types/widget-settings';
import type { RootStore } from '../root-store';

const STREAM_CHAT_WIDGET_ID = 'stream-chat';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

/**
 * Brings the settings file to the current schema and fills the stores from it.
 *
 * When it cannot — the file was written by a newer build, predates the chain,
 * or is not a settings object — the settings are locked rather than repaired.
 * A file we do not understand is worth more to the user intact than replaced
 * with defaults, and it can be sent to us as-is.
 */
const hydrateFromDisk = async (
  root: RootStore,
  loaded: Settings | null | undefined,
  { backup }: { backup: boolean }
) => {
  // The plugin hands back nothing both for a fresh install and for a file it
  // could not parse — a stray BOM, a half-written save. Only the filesystem
  // separates them, and seeding defaults over the second overwrites exactly the
  // file this whole path exists to protect.
  if (!loaded) {
    if (await settingsFileExists()) {
      console.error('Settings locked: present on disk but could not be read');
      root.appSettings.lockSettings('corrupt');
    }

    return;
  }

  // A migration step reads shapes that no current type describes, straight out
  // of a file the user may have hand-edited. A step that throws on one would
  // otherwise take the whole window down with it — no hydration, but no lock
  // and no banner either, which is the one outcome this path exists to avoid.
  let result: MigrationResult;

  try {
    result = runMigrations(loaded);
  } catch (error) {
    console.error('Settings locked: the migration chain threw:', error);
    root.appSettings.lockSettings('corrupt');

    return;
  }

  if (
    result.status === 'from-the-future' ||
    result.status === 'too-old' ||
    result.status === 'corrupt'
  ) {
    console.error(`Settings locked: ${result.status}`);
    root.appSettings.lockSettings(result.status);

    return;
  }

  if (result.status === 'migrated' && backup) {
    await backupSettingsFile(result.from);
  }

  try {
    hydrateStores(root, result.blob as Partial<Settings>);
  } catch (error) {
    console.error('Failed to hydrate settings:', error);
    root.appSettings.lockSettings('corrupt');
  }
};

export const initMainSync = async (root: RootStore) => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const store = await load(SETTINGS_FILE);
      const loadedSettings = await store.get<Settings>('settings');
      await hydrateFromDisk(root, loadedSettings, { backup: true });

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

      root.widgetSettings.ensureDefaultLayout();

      // Migrated layouts carry placeholder monitor positions — persisted
      // settings never recorded where the screens actually are. Nothing may
      // render or open a window before this lands them on the real desktop.
      root.widgetSettings.alignMonitorsToHardware(await listMonitorBounds());

      // Backstop for the locked state. The init path already returns before
      // reaching this, but every future caller goes through here.
      const onSave = () =>
        root.appSettings.settingsLocked
          ? Promise.resolve()
          : saveSettings(store, root);

      await onSave();

      await syncOverlayWindows(root);

      // Windows raises no event a Tauri app can subscribe to when displays are
      // rearranged, so the arrangement is polled while the app has focus.
      const stopMonitorWatch = watchMonitorArrangement(root, () => {
        void emitActiveLayoutToOverlays(root);
        void onSave();
      });

      const [
        overlaySettingsUnlisten,
        mainUnlistens,
        ,
        deviceBindingUnlistens,
        closeRequestedUnlisten,
      ] = await Promise.all([
        listen<MonitorWidgetsPayload>('widget-settings-updated', (e) => {
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
            root.widgetSettings.commitActiveLayout();
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

      const disposers = [
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
          () => JSON.stringify(root.widgetSettings.sessionLayouts),
          () => {
            void emitSessionLayoutsChanged(root.widgetSettings.sessionLayouts);
            void onSave();
          }
        ),
        reaction(
          () => {
            const isConnected = root.sim.isConnected;
            const isOnTrack = root.player.isOnTrack;
            const sessionType = root.session.currentSessionType;
            const autoSwitchLayouts =
              root.appSettings.appSettings.autoSwitchLayouts;
            const sessionLayouts = JSON.stringify(
              root.widgetSettings.sessionLayouts
            );
            return {
              isConnected,
              isOnTrack,
              sessionType,
              autoSwitchLayouts,
              sessionLayouts,
            };
          },
          ({ isConnected, isOnTrack, sessionType, autoSwitchLayouts }) => {
            if (!autoSwitchLayouts) return;
            if (root.widgetSettings.editorPreviewMode) return;
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

            if (context) {
              const layoutId = root.widgetSettings.sessionLayouts?.[context];
              if (layoutId && layoutId !== root.widgetSettings.activeLayoutId) {
                const exists = root.widgetSettings.layouts.some(
                  (l) => l.id === layoutId
                );
                if (exists) {
                  root.widgetSettings.loadLayout(layoutId, { notify: true });
                }
              }
            }
          },
          { fireImmediately: true }
        ),
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
        reaction(
          // One overlay window per monitor that has widgets on it. Switching
          // layouts, adding or removing a monitor config, enabling a widget,
          // dragging one to another screen and entering drag mode all change
          // that set.
          () => [
            root.widgetSettings.activeLayoutId,
            overlayMonitorNames(root).join('|'),
            root.widgetSettings.editorPreviewMode,
          ],
          () => {
            // While the editor previews a layout that isn't the active one, the
            // overlay must keep showing the previously-active layout — both its
            // widgets and its set of monitor windows.
            if (root.widgetSettings.editorPreviewMode) return;

            void syncOverlayWindows(root).then(() =>
              emitActiveLayoutToOverlays(root)
            );
          }
        ),
        // One binding registry, one dependency. Adding a bindable action is an
        // entry in ACTIONS and nothing else.
        reaction(
          () => root.bindings.mutationId,
          () => {
            void applyKeyboardBindings(root);
            // Overrides, not the effective map: the overlay layers the same
            // registry defaults underneath, so sending them would only make
            // every default look like a user choice on the other side.
            void emitBindingsChanged(root.bindings.overrides);
            void onSave();
          }
        ),
        // Reading wheels 125 times a second is only worth it while something
        // consumes the edges: a device binding exists, or the settings screen is
        // waiting for a button — to bind it, or to search by it.
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
        // Only the main window opens chat connections; overlays just listen to
        // the resulting chat:// events. Restarting on any source change keeps a
        // single code path for "connect" and "reconnect with new settings".
        reaction(
          () => ({
            // A disabled widget means nobody is reading chat, so the sockets
            // and the Helix polling should not be running either. The widgets
            // page renders its preview against a seeded store, so it never
            // needs a live connection.
            enabled:
              root.widgetSettings.getWidget(STREAM_CHAT_WIDGET_ID)?.userSettings
                .enabled === true,
            // Previewing another layout in the editor swaps the working copy
            // while the overlay still draws the active one — the connectors
            // follow the overlay, not the preview.
            editorPreviewMode: root.widgetSettings.editorPreviewMode,
            config: {
              twitchChannel:
                root.appSettings.appSettings.streamChatTwitchChannel,
              youtubeTarget:
                root.appSettings.appSettings.streamChatYoutubeTarget,
              twitchClientId:
                root.appSettings.appSettings.streamChatTwitchClientId,
              // Tokens stay in the OS credential store; this only signals that
              // the signed-in state changed and the connectors should restart.
              authRevision: root.appSettings.appSettings.streamChatAuthRevision,
            },
          }),
          ({ enabled, editorPreviewMode, config }) => {
            // The flag is part of the tracked value, so leaving preview mode
            // re-runs this with the real active layout.
            if (editorPreviewMode) {
              return;
            }

            const hasTarget = Boolean(
              config.twitchChannel?.trim() || config.youtubeTarget?.trim()
            );

            if (enabled && hasTarget) {
              void invoke('start_chat_stream', { config });
            } else {
              // Nothing to read, or nothing to read it with: tear the
              // connectors down and drop the buffer so re-enabling starts on
              // live messages instead of a stale backlog.
              void invoke('stop_chat_stream');
              root.chat.reset();
              void emitStreamChatCleared();
            }

            void onSave();
          },
          { equals: comparer.structural, fireImmediately: true, delay: 400 }
        ),
        reaction(
          () => ({
            hideCommands: root.appSettings.appSettings.streamChatHideCommands,
            ignoredBots: root.appSettings.appSettings.streamChatIgnoredBots,
          }),
          (filters) => {
            void emitStreamChatFilters(filters);
            void onSave();
          },
          { equals: comparer.structural }
        ),
        reaction(
          () => root.standingsWidget.activeClassIndex,
          (v) => {
            void emitStandingsClassIndex(v);
          }
        ),
        reaction(
          () => root.widgetSettings.changeToken,
          () => {
            if (!root.widgetSettings.editorPreviewMode) {
              void emitActiveLayoutToOverlays(root);
            }
          },
          { delay: 16 }
        ),
        reaction(
          // Widgets-catalog (preview page) edits only touch `defaultWidgets`,
          // which no other reaction observes — without this they'd never be
          // persisted and would reset on restart.
          () => root.widgetSettings.defaultsChangeToken,
          () => {
            void onSave();
          },
          { delay: 500 }
        ),
        reaction(
          // Commit on local edits (changeToken) AND on edits synced in from the
          // overlay's F9 drag mode (syncToken) so live-tweaks persist into the
          // active layout. Only this reaction watches syncToken — the emit
          // reaction must not, or main↔overlay would loop.
          () => [
            root.widgetSettings.changeToken,
            root.widgetSettings.syncToken,
          ],
          () => {
            root.widgetSettings.commitActiveLayout();
            void onSave();
          },
          {
            delay: 500,
          }
        ),
        reaction(
          () => root.pitServiceWidget.autoSuspended,
          (suspended) => {
            void emitPitServiceAutoSuspended(suspended);
          }
        ),
        // The automatic order is sent from this window only: both windows run
        // the same telemetry, so an overlay copy of these reactions would
        // broadcast the same order a second time.
        //
        // It goes out in two halves because the sim answers the two questions at
        // different moments — the fuel calculation is ours and ready on pit
        // entry, while tire wear is only refreshed once the car is in the box.
        reaction(
          () => root.pitServiceWidget.isOnPitRoad,
          (onPitRoad) => {
            if (onPitRoad) {
              void root.pitServiceWidget.applyAutoFuelOrder();
            }
          }
        ),
        // Three separate signals for the same moment, because their order is
        // not fixed: arriving in the box, the crew starting, and the wear
        // numbers refreshing have each been observed first. The tire half is
        // idempotent per stop, so the earliest one wins and the rest are no-ops.
        reaction(
          () => root.pitServiceWidget.isInPitStall,
          (inPitStall) => {
            if (inPitStall) {
              void root.pitServiceWidget.applyAutoTireOrder();
            }
          }
        ),
        reaction(
          () => root.pitServiceWidget.isServiceActive,
          (serviceActive) => {
            if (serviceActive) {
              void root.pitServiceWidget.applyAutoTireOrder();
            }
          }
        ),
        // A wear refresh only ever happens on arrival in the box, so on pit
        // road it is the arrival — and it is the signal that the threshold
        // check has something current to read, which the flags do not promise.
        reaction(
          () => root.pitServiceWidget.tireWearSignature,
          () => {
            if (root.pitServiceWidget.isOnPitRoad) {
              void root.pitServiceWidget.applyAutoTireOrder();
            }
          }
        ),
      ];

      const cleanup = () => {
        stopMonitorWatch();
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

export const initOverlaySync = async (root: RootStore) => {
  const store = await load(SETTINGS_FILE);
  const loadedSettings = await store.get<Settings>('settings');

  // The main window owns the backup — both windows run the chain, but only one
  // of them may touch the file.
  await hydrateFromDisk(root, loadedSettings, { backup: false });

  // Locked: the widget map still holds the shipped defaults, so loading the
  // active layout here would paint a default overlay across the user's screen —
  // indistinguishable from having lost their config. OverlayCanvas draws
  // nothing while the lock holds.
  if (root.appSettings.settingsLocked) {
    return () => {};
  }

  // hydrateStores fills the live widget map from the persisted snapshot, which
  // can lag behind the active layout. The window renders the layout, so it is
  // the layout that has to win.
  root.widgetSettings.loadActiveLayoutWidgets();

  const unlistens = await setupOverlayListeners(root);

  const disposers = [
    reaction(
      () => root.appSettings.dragMode,
      (v) => {
        void emitDragMode(v);
      }
    ),
    reaction(
      () => root.widgetSettings.changeToken,
      () => {
        const monitorName = root.widgetSettings.ownMonitorName;

        if (!monitorName) return;

        void emitWidgetSettingsToMain({
          monitorName,
          widgets: root.widgetSettings.allWidgets,
        });
      },
      { delay: 100 }
    ),
    // Clicks on the checkboxes land here, so this window can be the one that
    // takes the order off auto.
    reaction(
      () => root.pitServiceWidget.autoSuspended,
      (suspended) => {
        void emitPitServiceAutoSuspended(suspended);
      }
    ),
  ];

  return () => {
    unlistens.forEach((u) => u());
    disposers.forEach((d) => d());
  };
};
