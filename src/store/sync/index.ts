import { reaction, runInAction } from 'mobx';
import { load } from '@tauri-apps/plugin-store';
import { listen } from '@tauri-apps/api/event';
import { appSettingsStore } from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
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
import type { WidgetConfig } from '../../types/widget-settings';

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

export const initMainSync = async () => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
      const store = await load(SETTINGS_FILE);
      const saved = await store.get<Settings>('settings');

      if (saved) {
        hydrateStores(saved);
      }

      const onSave = () => saveSettings(store);

      await setupHotkeys(onSave);

      const overlayLayoutUnlisten = await listen<WidgetConfig[]>(
        'widget-layout-changed',
        (e) => {
          runInAction(() => widgetSettingsStore.setWidgets(e.payload));
        }
      );

      const mainUnlistens = await setupMainListeners();

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
              ...widgetSettingsStore.allWidgets.map((w) => w.hotkey),
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
  const saved = await store.get<Settings>('settings');

  if (saved) {
    hydrateStores(saved);
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
