import { runInAction, reaction } from 'mobx';
import { load } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { appSettingsStore } from './app-settings.store';
import { unitsStore, type UnitSystem } from './units.store';
import {
  widgetSettingsStore,
  type WidgetConfig,
} from './widget-settings.store';

interface Settings {
  app: {
    dragHotkey: string;
    hideAllWidgetsHotkey: string;
    hideWidgetsWhenGameClosed: boolean;
    hideAllWidgets: boolean;
  };
  units: {
    system: UnitSystem;
  };
  widgets: WidgetConfig[];
}

const SETTINGS_FILE = 'settings.json';

export const initMainSync = async () => {
  const store = await load(SETTINGS_FILE);
  const saved = await store.get<Settings>('settings');

  // Hydrate stores
  runInAction(() => {
    if (saved) {
      if (saved.app) {
        appSettingsStore.setDragHotkey(saved.app.dragHotkey);
        if (saved.app.hideAllWidgetsHotkey) {
          appSettingsStore.setHideAllWidgetsHotkey(
            saved.app.hideAllWidgetsHotkey
          );
        }
        appSettingsStore.setHideWidgetsWhenGameClosed(
          saved.app.hideWidgetsWhenGameClosed
        );
        appSettingsStore.setHideAllWidgets(saved.app.hideAllWidgets);
      }
      if (saved.units) {
        unitsStore.setSystem(saved.units.system);
      }
      if (saved.widgets) {
        widgetSettingsStore.setWidgets(saved.widgets);
      }
    }
  });

  const saveSettings = async () => {
    await store.set('settings', {
      app: {
        dragHotkey: appSettingsStore.dragHotkey,
        hideAllWidgetsHotkey: appSettingsStore.hideAllWidgetsHotkey,
        hideWidgetsWhenGameClosed: appSettingsStore.hideWidgetsWhenGameClosed,
        hideAllWidgets: appSettingsStore.hideAllWidgets,
      },
      units: {
        system: unitsStore.system,
      },
      widgets: widgetSettingsStore.widgets,
    });
    await store.save();
  };

  // Setup Hotkeys
  const setupHotkeys = async () => {
    await unregisterAll();

    // Drag Mode Hotkey
    try {
      await register(appSettingsStore.dragHotkey, (event) => {
        if (event.state === 'Pressed') {
          appSettingsStore.toggleDragMode();
        }
      });
    } catch (e) {
      console.error('Failed to register drag hotkey:', e);
    }

    // Hide All Widgets Hotkey
    try {
      if (appSettingsStore.hideAllWidgetsHotkey) {
        await register(appSettingsStore.hideAllWidgetsHotkey, (event) => {
          if (event.state === 'Pressed') {
            appSettingsStore.toggleHideAllWidgets();
          }
        });
      }
    } catch (e) {
      console.error('Failed to register hide all hotkey:', e);
    }

    // Widget Toggle Hotkeys
    for (const widget of widgetSettingsStore.widgets) {
      if (widget.hotkey) {
        try {
          await register(widget.hotkey, (event) => {
            if (event.state === 'Pressed') {
              widgetSettingsStore.setWidgetEnabled(widget.id, !widget.enabled);
            }
          });
        } catch (e) {
          console.error(`Failed to register hotkey for ${widget.id}:`, e);
        }
      }
    }
  };

  await setupHotkeys();

  // Reactions
  const disposers = [
    reaction(
      () => ({
        dragMode: appSettingsStore.dragMode,
      }),
      (vals) => {
        void emit('drag-mode-changed', vals.dragMode);
      }
    ),
    reaction(
      () => ({
        hideAllWidgets: appSettingsStore.hideAllWidgets,
      }),
      (vals) => {
        void emit('hide-all-widgets-changed', vals.hideAllWidgets);
        void saveSettings();
      }
    ),
    reaction(
      () => ({
        hideWidgetsWhenGameClosed: appSettingsStore.hideWidgetsWhenGameClosed,
      }),
      (vals) => {
        void emit(
          'hide-widgets-when-game-closed-changed',
          vals.hideWidgetsWhenGameClosed
        );
        void saveSettings();
      }
    ),
    reaction(
      () => [
        appSettingsStore.dragHotkey,
        appSettingsStore.hideAllWidgetsHotkey,
      ],
      () => {
        void setupHotkeys();
        void saveSettings();
      }
    ),
    reaction(
      () => unitsStore.system,
      (system) => {
        void emit('units-changed', system);
        void saveSettings();
      }
    ),
    reaction(
      () => JSON.stringify(widgetSettingsStore.widgets),
      () => {
        // Broadcast changes to overlay immediately for smooth UI sync
        void emit('widget-settings-updated', widgetSettingsStore.widgets);
      },
      { delay: 16 }
    ),
    reaction(
      () => JSON.stringify(widgetSettingsStore.widgets),
      () => {
        void saveSettings();
      },
      { delay: 500 } // Debounce disk I/O
    ),
  ];

  return () => {
    disposers.forEach((d) => d());
    void unregisterAll();
  };
};

export const initOverlaySync = async () => {
  // Initial load to be in sync (though main should broadcast eventually)
  const store = await load(SETTINGS_FILE);
  const saved = await store.get<Settings>('settings');

  runInAction(() => {
    if (saved) {
      if (saved.app) {
        appSettingsStore.setHideWidgetsWhenGameClosed(
          saved.app.hideWidgetsWhenGameClosed
        );
        appSettingsStore.setHideAllWidgets(saved.app.hideAllWidgets);
      }
      if (saved.units) {
        unitsStore.setSystem(saved.units.system);
      }
      if (saved.widgets) {
        widgetSettingsStore.setWidgets(saved.widgets);
      }
    }
  });

  const unlistens: UnlistenFn[] = [];

  unlistens.push(
    await listen<boolean>('drag-mode-changed', (event) => {
      runInAction(() => {
        appSettingsStore.setDragMode(event.payload);
      });
    })
  );

  unlistens.push(
    await listen<boolean>('hide-all-widgets-changed', (event) => {
      runInAction(() => {
        appSettingsStore.setHideAllWidgets(event.payload);
      });
    })
  );

  unlistens.push(
    await listen<boolean>('hide-widgets-when-game-closed-changed', (event) => {
      runInAction(() => {
        appSettingsStore.setHideWidgetsWhenGameClosed(event.payload);
      });
    })
  );

  unlistens.push(
    await listen<UnitSystem>('units-changed', (event) => {
      runInAction(() => {
        unitsStore.setSystem(event.payload);
      });
    })
  );

  unlistens.push(
    await listen<WidgetConfig[]>('widget-settings-updated', (event) => {
      runInAction(() => {
        widgetSettingsStore.setWidgets(event.payload);
      });
    })
  );

  return () => {
    unlistens.forEach((u) => u());
  };
};
