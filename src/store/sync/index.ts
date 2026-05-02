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

      const disposers = [
        reaction(
          () => appSettingsStore.dragMode,
          (v) => {
            void emitDragMode(v);
          }
        ),
        reaction(
          () => appSettingsStore.hideAllWidgets,
          (v) => {
            void emitHideAllWidgets(v);
            void onSave();
          }
        ),
        reaction(
          () => appSettingsStore.hideWidgetsWhenGameClosed,
          (v) => {
            void emitHideWidgetsWhenGameClosed(v);
            void onSave();
          }
        ),
        reaction(
          () => {
            const s = widgetSettingsStore.getStandingsSettings();
            return [
              appSettingsStore.dragHotkey,
              appSettingsStore.hideAllWidgetsHotkey,
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

  return () => unlistens.forEach((u) => u());
};
