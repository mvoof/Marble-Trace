import { runInAction, reaction } from 'mobx';
import { load } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
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
  const registeredShortcuts = new Set<string>();

  const setupHotkeys = async () => {
    // Unregister only previously registered shortcuts
    for (const shortcut of registeredShortcuts) {
      try {
        await unregister(shortcut);
      } catch {
        // Ignore
      }
    }
    registeredShortcuts.clear();

    const registerSafe = async (
      shortcut: string,
      handler: (event: { state: 'Pressed' | 'Released' }) => void
    ) => {
      if (!shortcut || registeredShortcuts.has(shortcut)) return;
      try {
        await register(shortcut, handler);
        registeredShortcuts.add(shortcut);
      } catch (e) {
        console.error(`Failed to register hotkey: ${shortcut}`, e);
      }
    };

    // Drag Mode Hotkey
    await registerSafe(appSettingsStore.dragHotkey, (event) => {
      if (event.state === 'Pressed') {
        appSettingsStore.toggleDragMode();
      }
    });

    // Hide All Widgets Hotkey
    if (appSettingsStore.hideAllWidgetsHotkey) {
      await registerSafe(appSettingsStore.hideAllWidgetsHotkey, (event) => {
        if (event.state === 'Pressed') {
          appSettingsStore.toggleHideAllWidgets();
        }
      });
    }

    // Widget Toggle Hotkeys
    for (const widget of widgetSettingsStore.widgets) {
      if (widget.hotkey) {
        await registerSafe(widget.hotkey, (event) => {
          if (event.state === 'Pressed') {
            widgetSettingsStore.setWidgetEnabled(widget.id, !widget.enabled);
          }
        });
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
        ...widgetSettingsStore.widgets.map((w) => w.hotkey),
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
    for (const shortcut of registeredShortcuts) {
      void unregister(shortcut);
    }
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
