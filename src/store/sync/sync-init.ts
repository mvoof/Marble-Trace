import { reaction, runInAction } from 'mobx';
import { load } from '@tauri-apps/plugin-store';
import { listen } from '@tauri-apps/api/event';
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
  emitUnitsChanged,
  emitStandingsClassIndex,
  emitTrackMapForceStartPending,
  emitWidgetSettingsUpdated,
} from './events';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
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

      const onSave = () => saveSettings(store, root);

      const [overlayLayoutUnlisten, mainUnlistens] = await Promise.all([
        listen<WidgetDefaultConfig[]>('widget-layout-changed', (e) => {
          runInAction(() => root.widgetSettings.setWidgets(e.payload));
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
          () => root.appSettings.settings.hideAllWidgets,
          (v) => {
            void emitHideAllWidgets(v);
            void onSave();
          }
        ),
        reaction(
          () => root.appSettings.settings.hideWidgetsWhenGameClosed,
          (v) => {
            void emitHideWidgetsWhenGameClosed(v);
            void onSave();
          }
        ),
        reaction(
          () => root.appSettings.settings.autoUpdate,
          () => {
            void onSave();
          }
        ),
        reaction(
          () => root.appSettings.settings.updateCheckInterval,
          () => {
            void onSave();
          }
        ),
        reaction(
          () => root.appSettings.settings.lastUpdateCheck,
          () => {
            void onSave();
          }
        ),
        reaction(
          () => {
            const standingsSettings =
              root.widgetSettings.getStandingsSettings();
            return [
              root.appSettings.settings.dragHotkey,
              root.appSettings.settings.hideAllWidgetsHotkey,
              ...root.widgetSettings.allWidgets.map(
                (w) => w.userSettings.hotkey
              ),
              standingsSettings.classCyclingToggleHotkey,
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
          () => root.units.system,
          (v) => {
            void emitUnitsChanged(v);
            void onSave();
          }
        ),
        reaction(
          () => root.widgetSettings.standingsActiveClassIndex,
          (v) => {
            void emitStandingsClassIndex(v);
          }
        ),
        reaction(
          () => root.widgetSettings.isTrackMapForceStartPending,
          (v) => {
            void emitTrackMapForceStartPending(v);
          }
        ),
        reaction(
          () => JSON.stringify(root.widgetSettings.allWidgets),
          () => {
            void emitWidgetSettingsUpdated(root.widgetSettings.allWidgets);
          },
          { delay: 16 }
        ),
        reaction(
          () => JSON.stringify(root.widgetSettings.allWidgets),
          () => {
            void onSave();
          },
          {
            delay: 500,
          }
        ),
      ];

      return () => {
        void overlayLayoutUnlisten();

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

  const unlistens = await setupOverlayListeners(root);

  const disposers = [
    reaction(
      () => root.appSettings.dragMode,
      (v) => {
        void emitDragMode(v);
      }
    ),
  ];

  return () => {
    unlistens.forEach((u) => u());
    disposers.forEach((d) => d());
  };
};
