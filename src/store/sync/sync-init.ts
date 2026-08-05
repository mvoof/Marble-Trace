import { comparer, reaction } from 'mobx';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { load } from '@tauri-apps/plugin-store';
import {
  hydrateStores,
  saveSettings,
  logSettingsSnapshot,
  SETTINGS_FILE,
  Settings,
} from './persistence';
import { setupHotkeys, cleanupHotkeys } from './hotkeys';
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
} from './events';
import type { MonitorWidgetsPayload } from './events';
import { overlayMonitorNames, syncOverlayWindows } from './overlay-windows';
import { listMonitorBounds } from './overlay-resolution';
import { watchMonitorArrangement } from './monitor-watch';
import type {
  StandingsWidgetSettings,
  PitServiceWidgetSettings,
  SessionContext,
} from '@/types/widget-settings';
import type { RootStore } from '../root-store';

const STREAM_CHAT_WIDGET_ID = 'stream-chat';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

export const initMainSync = async (root: RootStore) => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const store = await load(SETTINGS_FILE);
      const loadedSettings = await store.get<Settings>('settings');

      if (loadedSettings) {
        try {
          hydrateStores(root, loadedSettings);
          await saveSettings(store, root);
        } catch {
          await store.delete('settings');
          await store.save();
        }
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

      const onSave = () => saveSettings(store, root);

      await onSave();

      await syncOverlayWindows(root);

      // Windows raises no event a Tauri app can subscribe to when displays are
      // rearranged, so the arrangement is polled while the app has focus.
      const stopMonitorWatch = watchMonitorArrangement(root, () => {
        void emitActiveLayoutToOverlays(root);
        void onSave();
      });

      const [overlaySettingsUnlisten, mainUnlistens, , closeRequestedUnlisten] =
        await Promise.all([
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
          setupHotkeys(root, onSave),
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
        reaction(
          () => {
            const standingsSettings =
              root.widgetSettings.getSettings<StandingsWidgetSettings>(
                'standings'
              );
            const pitServiceSettings =
              root.widgetSettings.getSettings<PitServiceWidgetSettings>(
                'pit-service'
              );

            return [
              root.appSettings.appSettings.dragHotkey,
              root.appSettings.appSettings.hideAllWidgetsHotkey,
              root.appSettings.appSettings.interactHotkey,
              root.appSettings.appSettings.interactHotkeyMode,
              standingsSettings.viewModeHotkey,
              standingsSettings.classPrevHotkey,
              standingsSettings.classNextHotkey,
              standingsSettings.scrollUpHotkey,
              standingsSettings.scrollDownHotkey,
              pitServiceSettings.toggleHotkey,
              pitServiceSettings.applyOrderHotkey,
              pitServiceSettings.clearOrderHotkey,
              pitServiceSettings.enableCommands,
            ];
          },
          () => {
            void setupHotkeys(root, onSave);
            void onSave();
          }
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
      ];

      const cleanup = () => {
        stopMonitorWatch();
        overlaySettingsUnlisten();
        closeRequestedUnlisten();

        mainUnlistens.forEach((u) => u());
        disposers.forEach((d) => d());

        cleanupHotkeys();

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

  if (loadedSettings) {
    hydrateStores(root, loadedSettings);
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
  ];

  return () => {
    unlistens.forEach((u) => u());
    disposers.forEach((d) => d());
  };
};
