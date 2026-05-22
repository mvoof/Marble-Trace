import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import type { RootStore } from '../root-store';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

const registeredShortcuts = new Set<string>();
let isSettingUp = false;
let pendingSetup = false;

export const setupHotkeys = async (
  root: RootStore,
  onSave?: () => Promise<void>
) => {
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

    if (root.appSettings.settings.dragHotkey) {
      addHandler(root.appSettings.settings.dragHotkey, (event) => {
        if (event.state === 'Pressed') root.appSettings.toggleDragMode();
      });
    }

    if (root.appSettings.settings.hideAllWidgetsHotkey) {
      addHandler(root.appSettings.settings.hideAllWidgetsHotkey, (event) => {
        if (event.state === 'Pressed') root.appSettings.toggleHideAllWidgets();
      });
    }

    for (const widget of root.widgetSettings.allWidgets) {
      if (widget.userSettings.hotkey) {
        addHandler(widget.userSettings.hotkey, (event) => {
          if (event.state === 'Pressed') {
            root.widgetSettings.setWidgetEnabled(
              widget.id,
              !widget.userSettings.enabled
            );
          }
        });
      }
    }

    const settings =
      root.widgetSettings.getSettings<StandingsWidgetSettings>('standings');

    if (settings.classCyclingToggleHotkey) {
      addHandler(settings.classCyclingToggleHotkey, (event) => {
        if (event.state === 'Pressed')
          root.widgetSettings.toggleStandingsClassCycling();
      });
    }

    if (settings.classPrevHotkey) {
      addHandler(settings.classPrevHotkey, (event) => {
        if (event.state === 'Pressed') {
          const totalClasses = new Set(
            root.backendComputed.standings?.entries.map((e) => e.carClassId) ??
              []
          ).size;

          root.widgetSettings.cycleStandingsPrev(totalClasses);
        }
      });
    }

    if (settings.classNextHotkey) {
      addHandler(settings.classNextHotkey, (event) => {
        if (event.state === 'Pressed') {
          const totalClasses = new Set(
            root.backendComputed.standings?.entries.map((e) => e.carClassId) ??
              []
          ).size;
          root.widgetSettings.cycleStandingsNext(totalClasses);
        }
      });
    }

    await Promise.all(
      Array.from(registeredShortcuts).map(async (shortcut) => {
        try {
          await unregister(shortcut);
        } catch {
          /* ignore */
        }
      })
    );

    registeredShortcuts.clear();

    await Promise.all(
      Array.from(handlersMap.entries()).map(async ([shortcut, handlers]) => {
        try {
          try {
            await unregister(shortcut);
          } catch {
            /* ignore */
          }

          await register(shortcut, (event) => {
            handlers.forEach((handler) => handler(event));
          });

          registeredShortcuts.add(shortcut);
        } catch (e) {
          console.error(`[hotkey] FAILED to register: "${shortcut}"`, e);
        }
      })
    );
  } finally {
    isSettingUp = false;

    if (pendingSetup) {
      pendingSetup = false;
      void setupHotkeys(root, onSave);
    }
  }
};

export const cleanupHotkeys = () => {
  for (const shortcut of Array.from(registeredShortcuts)) {
    void unregister(shortcut);
  }

  registeredShortcuts.clear();
};
