import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { appSettingsStore } from '../app-settings.store';
import { widgetSettingsStore } from '../widget-settings.store';
import { computedStore } from '../iracing';

const registeredShortcuts = new Set<string>();
let isSettingUp = false;
let pendingSetup = false;

export const setupHotkeys = async (onSave?: () => Promise<void>) => {
  if (isSettingUp) {
    pendingSetup = true;
    return;
  }
  isSettingUp = true;

  try {
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
        if (event.state === 'Pressed') appSettingsStore.toggleHideAllWidgets();
      });
    }

    for (const widget of widgetSettingsStore.allWidgets) {
      if (widget.hotkey) {
        addHandler(widget.hotkey, (event) => {
          if (event.state === 'Pressed') {
            widgetSettingsStore.setWidgetEnabled(widget.id, !widget.enabled);
          }
        });
      }
    }

    const s = widgetSettingsStore.getStandingsSettings();
    if (s.classCyclingToggleHotkey) {
      addHandler(s.classCyclingToggleHotkey, (event) => {
        if (event.state === 'Pressed')
          widgetSettingsStore.toggleStandingsClassCycling();
      });
    }
    if (s.classPrevHotkey) {
      addHandler(s.classPrevHotkey, (event) => {
        if (event.state === 'Pressed') {
          const totalClasses = new Set(
            computedStore.standings?.entries.map((e) => e.carClassId) ?? []
          ).size;
          widgetSettingsStore.cycleStandingsPrev(totalClasses);
        }
      });
    }
    if (s.classNextHotkey) {
      addHandler(s.classNextHotkey, (event) => {
        if (event.state === 'Pressed') {
          const totalClasses = new Set(
            computedStore.standings?.entries.map((e) => e.carClassId) ?? []
          ).size;
          widgetSettingsStore.cycleStandingsNext(totalClasses);
        }
      });
    }

    for (const shortcut of Array.from(registeredShortcuts)) {
      try {
        await unregister(shortcut);
      } catch {
        /* ignore */
      }
    }
    registeredShortcuts.clear();

    for (const [shortcut, handlers] of handlersMap.entries()) {
      try {
        try {
          await unregister(shortcut);
        } catch {
          /* ignore */
        }
        await register(shortcut, (event) => {
          handlers.forEach((h) => h(event));
        });
        registeredShortcuts.add(shortcut);
      } catch (e) {
        console.error(`[hotkey] FAILED to register: "${shortcut}"`, e);
      }
    }
  } finally {
    isSettingUp = false;
    if (pendingSetup) {
      pendingSetup = false;
      void setupHotkeys(onSave);
    }
  }
};

export const cleanupHotkeys = () => {
  for (const shortcut of Array.from(registeredShortcuts)) {
    void unregister(shortcut);
  }
  registeredShortcuts.clear();
};
