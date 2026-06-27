import { reaction } from 'mobx';
import { listen } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import {
  hydrateStores,
  saveSettings,
  SETTINGS_FILE,
  Settings,
} from './persistence';
import { setupHotkeys, cleanupHotkeys } from './hotkeys';
import {
  setupMainListeners,
  setupOverlayListeners,
  emitDragMode,
  emitHideAllWidgets,
  emitHideWidgetsWhenGameClosed,
  emitHideWidgetsInGarage,
  emitUnitsChanged,
  emitStandingsClassIndex,
  emitWidgetSettingsUpdated,
  emitWidgetSettingsToMain,
  emitOverlayMonitorChanged,
} from './events';
import type {
  WidgetDefaultConfig,
  StandingsWidgetSettings,
} from '@/types/widget-settings';
import type { RootStore } from '../root-store';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

export const initMainSync = async (root: RootStore) => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const store = await load(SETTINGS_FILE);
      const loadedSettings = await store.get<Settings>('settings');
      console.log({ loadedSettings });

      if (loadedSettings) {
        try {
          hydrateStores(root, loadedSettings);
          await saveSettings(store, root);
        } catch {
          await store.delete('settings');
          await store.save();
        }
      }

      root.widgetSettings.ensureDefaultLayout();

      const onSave = () => saveSettings(store, root);

      await onSave();

      const [overlaySettingsUnlisten, mainUnlistens] = await Promise.all([
        listen<WidgetDefaultConfig[]>('widget-settings-updated', (e) => {
          root.widgetSettings.applySettingsSync(e.payload);
          void onSave();
        }),
        setupMainListeners(root),
        setupHotkeys(root, onSave),
      ]);

      const disposers = [
        reaction(
          () => root.appSettings.dragMode,
          (v) => {
            void emitDragMode(v);
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
          () => root.appSettings.appSettings.hideWidgetsInGarage,
          (v) => {
            void emitHideWidgetsInGarage(v);
            void onSave();
          }
        ),
        reaction(
          () => root.appSettings.appSettings.autoUpdate,
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
          () => root.widgetSettings.activeLayout?.activeMonitorName ?? null,
          (name) => {
            void emitOverlayMonitorChanged(name);
          }
        ),
        reaction(
          () => {
            const standingsSettings =
              root.widgetSettings.getSettings<StandingsWidgetSettings>(
                'standings'
              );
            return [
              root.appSettings.appSettings.dragHotkey,
              root.appSettings.appSettings.hideAllWidgetsHotkey,
              standingsSettings.viewModeHotkey,
              standingsSettings.classPrevHotkey,
              standingsSettings.classNextHotkey,
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
          () => root.standingsWidget.activeClassIndex,
          (v) => {
            void emitStandingsClassIndex(v);
          }
        ),
        reaction(
          () => root.widgetSettings.changeToken,
          () => {
            void emitWidgetSettingsUpdated(root.widgetSettings.allWidgets);
          },
          { delay: 16 }
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

      return () => {
        overlaySettingsUnlisten();

        mainUnlistens.forEach((u) => u());
        disposers.forEach((d) => d());

        cleanupHotkeys();

        mainSyncInitPromise = null;
      };
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

  // Overlay resolution is set by OverlayWindow AFTER it resizes the window to the
  // target monitor — setting it here would capture the stale pre-resize size.

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
        void emitWidgetSettingsToMain(root.widgetSettings.allWidgets);
      },
      { delay: 100 }
    ),
  ];

  return () => {
    unlistens.forEach((u) => u());
    disposers.forEach((d) => d());
  };
};
