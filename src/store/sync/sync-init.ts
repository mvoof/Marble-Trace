import { reaction, runInAction } from 'mobx';
import { load } from '@tauri-apps/plugin-store';
import { listen } from '@tauri-apps/api/event';
import { appSettingsStore } from '@store/app-settings.store';
import { unitsStore } from '@store/units.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
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

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

export const initMainSync = async () => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const store = await load(SETTINGS_FILE);
      const loadedSettings = await store.get<Settings>('settings');
      console.log({ loadedSettings });

      if (loadedSettings) {
        try {
          hydrateStores(loadedSettings);
          await saveSettings(store);
        } catch {
          await store.delete('settings');
          await store.save();
        }
      }

      const onSave = () => saveSettings(store);

      const [overlayLayoutUnlisten, mainUnlistens] = await Promise.all([
        listen<WidgetDefaultConfig[]>('widget-layout-changed', (e) => {
          runInAction(() => widgetSettingsStore.setWidgets(e.payload));
        }),
        setupMainListeners(),
        setupHotkeys(onSave),
      ]);

      const disposers = [
        reaction(
          () => appSettingsStore.dragMode,
          (v) => {
            void emitDragMode(v);
          }
        ),
        reaction(
          () => appSettingsStore.settings.hideAllWidgets,
          (v) => {
            void emitHideAllWidgets(v);
            void onSave();
          }
        ),
        reaction(
          () => appSettingsStore.settings.hideWidgetsWhenGameClosed,
          (v) => {
            void emitHideWidgetsWhenGameClosed(v);
            void onSave();
          }
        ),
        reaction(
          () => appSettingsStore.settings.autoUpdate,
          () => {
            void onSave();
          }
        ),
        reaction(
          () => appSettingsStore.settings.updateCheckInterval,
          () => {
            void onSave();
          }
        ),
        reaction(
          () => appSettingsStore.settings.lastUpdateCheck,
          () => {
            void onSave();
          }
        ),
        reaction(
          () => {
            const s = widgetSettingsStore.getStandingsSettings();
            return [
              appSettingsStore.settings.dragHotkey,
              appSettingsStore.settings.hideAllWidgetsHotkey,
              ...widgetSettingsStore.allWidgets.map(
                (w) => w.userSettings.hotkey
              ),
              s.classCyclingToggleHotkey,
              s.classPrevHotkey,
              s.classNextHotkey,
            ];
          },
          () => {
            void setupHotkeys(onSave);
            void onSave();
          }
        ),
        reaction(
          () => unitsStore.system,
          (v) => {
            void emitUnitsChanged(v);
            void onSave();
          }
        ),
        reaction(
          () => widgetSettingsStore.standingsActiveClassIndex,
          (v) => {
            void emitStandingsClassIndex(v);
          }
        ),
        reaction(
          () => widgetSettingsStore.isTrackMapForceStartPending,
          (v) => {
            void emitTrackMapForceStartPending(v);
          }
        ),
        reaction(
          () => JSON.stringify(widgetSettingsStore.allWidgets),
          () => {
            void emitWidgetSettingsUpdated(widgetSettingsStore.allWidgets);
          },
          { delay: 16 }
        ),
        reaction(
          () => JSON.stringify(widgetSettingsStore.allWidgets),
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

export const initOverlaySync = async () => {
  const store = await load(SETTINGS_FILE);
  const loadedSettings = await store.get<Settings>('settings');

  if (loadedSettings) {
    hydrateStores(loadedSettings);
  }

  const unlistens = await setupOverlayListeners();

  // Needed so the overlay's "Exit Edit Mode" button syncs dragMode back to the main window.
  const disposers = [
    reaction(
      () => appSettingsStore.dragMode,
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
