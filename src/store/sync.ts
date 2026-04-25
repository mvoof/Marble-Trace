import { runInAction, reaction } from 'mobx';
import { load } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { appSettingsStore } from './app-settings.store';
import { unitsStore } from './units.store';
import { widgetSettingsStore } from './widget-settings.store';
import type { UnitSystem } from '../types/units';
import type { WidgetConfig } from '../types/widget-settings';

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

let mainSyncInitPromise: Promise<() => void> | null = null;
let mainSyncRefCount = 0;

export const initMainSync = async () => {
  mainSyncRefCount++;

  if (!mainSyncInitPromise) {
    mainSyncInitPromise = (async () => {
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
            hideWidgetsWhenGameClosed:
              appSettingsStore.hideWidgetsWhenGameClosed,
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
      let isSettingUp = false;
      let pendingSetup = false;

      const setupHotkeys = async () => {
        if (isSettingUp) {
          pendingSetup = true;
          return;
        }
        isSettingUp = true;

        try {
          // 1. Gather all hotkeys we WANT to register
          const handlersMap = new Map<
            string,
            Array<(event: { state: 'Pressed' | 'Released' }) => void>
          >();

          const addHandler = (
            shortcut: string,
            handler: (event: { state: 'Pressed' | 'Released' }) => void
          ) => {
            if (!shortcut) return;
            if (!handlersMap.has(shortcut)) {
              handlersMap.set(shortcut, []);
            }
            handlersMap.get(shortcut)!.push(handler);
          };

          if (appSettingsStore.dragHotkey) {
            addHandler(appSettingsStore.dragHotkey, (event) => {
              if (event.state === 'Pressed') appSettingsStore.toggleDragMode();
            });
          }

          if (appSettingsStore.hideAllWidgetsHotkey) {
            addHandler(appSettingsStore.hideAllWidgetsHotkey, (event) => {
              if (event.state === 'Pressed')
                appSettingsStore.toggleHideAllWidgets();
            });
          }

          for (const widget of widgetSettingsStore.widgets) {
            if (widget.hotkey) {
              addHandler(widget.hotkey, (event) => {
                if (event.state === 'Pressed') {
                  widgetSettingsStore.setWidgetEnabled(
                    widget.id,
                    !widget.enabled
                  );
                }
              });
            }
          }

          const standingsSettings = widgetSettingsStore.getStandingsSettings();

          if (standingsSettings.classCyclingToggleHotkey) {
            addHandler(standingsSettings.classCyclingToggleHotkey, (event) => {
              if (event.state === 'Pressed')
                widgetSettingsStore.toggleStandingsClassCycling();
            });
          }

          if (standingsSettings.classPrevHotkey) {
            addHandler(standingsSettings.classPrevHotkey, (event) => {
              if (event.state === 'Pressed')
                widgetSettingsStore.cycleStandingsPrev();
            });
          }

          if (standingsSettings.classNextHotkey) {
            addHandler(standingsSettings.classNextHotkey, (event) => {
              if (event.state === 'Pressed')
                widgetSettingsStore.cycleStandingsNext();
            });
          }

          // 2. Unregister only what was previously registered in THIS session
          for (const shortcut of Array.from(registeredShortcuts)) {
            try {
              await unregister(shortcut);
            } catch {
              /* ignore */
            }
          }
          registeredShortcuts.clear();

          // 3. Register new hotkeys, but try to unregister each one first to be safe
          // against "stuck" keys from previous reloads/crashes
          for (const [shortcut, handlers] of handlersMap.entries()) {
            try {
              // Try unregistering just in case it's "stuck" in the backend
              try {
                await unregister(shortcut);
              } catch {
                /* ignore */
              }

              await register(shortcut, (event) => {
                handlers.forEach((h) => h(event));
              });
              registeredShortcuts.add(shortcut);
              console.log(`[hotkey] registered: "${shortcut}"`);
            } catch (e) {
              console.error(`[hotkey] FAILED to register: "${shortcut}"`, e);
            }
          }
        } finally {
          isSettingUp = false;
          if (pendingSetup) {
            pendingSetup = false;
            void setupHotkeys();
          }
        }
      };

      // Initial setup
      await setupHotkeys();

      // Reactions
      const overlayLayoutUnlisten = await listen<WidgetConfig[]>(
        'widget-layout-changed',
        (e) => {
          runInAction(() => widgetSettingsStore.setWidgets(e.payload));
        }
      );

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
            hideWidgetsWhenGameClosed:
              appSettingsStore.hideWidgetsWhenGameClosed,
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
          () => {
            const s = widgetSettingsStore.getStandingsSettings();
            return [
              appSettingsStore.dragHotkey,
              appSettingsStore.hideAllWidgetsHotkey,
              ...widgetSettingsStore.widgets.map((w) => w.hotkey),
              s.classCyclingToggleHotkey,
              s.classPrevHotkey,
              s.classNextHotkey,
            ];
          },
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
          () => widgetSettingsStore.standingsActiveClassIndex,
          (index) => {
            void emit('standings-class-index-changed', index);
          }
        ),
        reaction(
          () => widgetSettingsStore.isTrackMapForceStartPending,
          (pending) => {
            void emit('track-map:force-start-pending-changed', pending);
          }
        ),
        reaction(
          () => JSON.stringify(widgetSettingsStore.widgets),
          () => {
            void emit('widget-settings-updated', widgetSettingsStore.widgets);
          },
          { delay: 16 }
        ),
        reaction(
          () => JSON.stringify(widgetSettingsStore.widgets),
          () => {
            void saveSettings();
          },
          { delay: 500 }
        ),
      ];

      return () => {
        overlayLayoutUnlisten();
        disposers.forEach((d) => d());
        for (const shortcut of Array.from(registeredShortcuts)) {
          void unregister(shortcut);
        }
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
    await listen<boolean>('drag-mode-changed', (e) => {
      runInAction(() => appSettingsStore.setDragMode(e.payload));
    })
  );
  unlistens.push(
    await listen<boolean>('hide-all-widgets-changed', (e) => {
      runInAction(() => appSettingsStore.setHideAllWidgets(e.payload));
    })
  );
  unlistens.push(
    await listen<boolean>('hide-widgets-when-game-closed-changed', (e) => {
      runInAction(() =>
        appSettingsStore.setHideWidgetsWhenGameClosed(e.payload)
      );
    })
  );
  unlistens.push(
    await listen<UnitSystem>('units-changed', (e) => {
      runInAction(() => unitsStore.setSystem(e.payload));
    })
  );
  unlistens.push(
    await listen<WidgetConfig[]>('widget-settings-updated', (e) => {
      runInAction(() => widgetSettingsStore.setWidgets(e.payload));
    })
  );
  unlistens.push(
    await listen<number>('standings-class-index-changed', (e) => {
      runInAction(() => {
        widgetSettingsStore.standingsActiveClassIndex = e.payload;
      });
    })
  );
  unlistens.push(
    await listen<boolean>('track-map:force-start-pending-changed', (e) => {
      runInAction(() =>
        widgetSettingsStore.setTrackMapForceStartPending(e.payload)
      );
    })
  );

  return () => unlistens.forEach((u) => u());
};
