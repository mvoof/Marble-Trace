import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import type { RootStore } from '@store/root-store';
import type {
  PitServiceWidgetSettings,
  StandingsWidgetSettings,
} from '@/types/widget-settings';
import { emitPitServiceToggle, emitStandingsScroll } from './events';

// One keypress moves the standings by a small block rather than a single row —
// a hotkey has no inertia, so row-by-row stepping is too slow to be usable.
const SCROLL_STEP_ROWS = 3;

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

    if (root.appSettings.appSettings.dragHotkey) {
      addHandler(root.appSettings.appSettings.dragHotkey, (event) => {
        if (event.state === 'Pressed') root.appSettings.toggleDragMode();
      });
    }

    if (root.appSettings.appSettings.interactHotkey) {
      addHandler(root.appSettings.appSettings.interactHotkey, (event) => {
        if (root.appSettings.appSettings.interactHotkeyMode === 'hold') {
          root.appSettings.setInteractMode(event.state === 'Pressed');

          return;
        }

        if (event.state === 'Pressed') {
          root.appSettings.toggleInteractMode();
        }
      });
    }

    if (root.appSettings.appSettings.hideAllWidgetsHotkey) {
      addHandler(root.appSettings.appSettings.hideAllWidgetsHotkey, (event) => {
        if (event.state === 'Pressed') root.appSettings.toggleHideAllWidgets();
      });
    }

    const settings =
      root.widgetSettings.getSettings<StandingsWidgetSettings>('standings');

    if (settings.viewModeHotkey) {
      addHandler(settings.viewModeHotkey, (event) => {
        if (event.state === 'Pressed')
          root.widgetSettings.cycleStandingsViewMode();
      });
    }

    if (settings.classPrevHotkey) {
      addHandler(settings.classPrevHotkey, (event) => {
        if (event.state === 'Pressed') {
          const totalClasses = new Set(
            root.backendComputed.standings?.entries.map((e) => e.carClassId) ??
              []
          ).size;

          root.standingsWidget.cyclePrev(totalClasses);
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
          root.standingsWidget.cycleNext(totalClasses);
        }
      });
    }

    if (settings.scrollUpHotkey) {
      addHandler(settings.scrollUpHotkey, (event) => {
        if (event.state === 'Pressed') {
          void emitStandingsScroll(-SCROLL_STEP_ROWS);
        }
      });
    }

    if (settings.scrollDownHotkey) {
      addHandler(settings.scrollDownHotkey, (event) => {
        if (event.state === 'Pressed') {
          void emitStandingsScroll(SCROLL_STEP_ROWS);
        }
      });
    }

    const pitService =
      root.widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

    if (pitService.toggleHotkey) {
      addHandler(pitService.toggleHotkey, (event) => {
        if (event.state === 'Pressed') {
          root.pitServiceWidget.toggleManualShow();
          void emitPitServiceToggle();
        }
      });
    }

    if (pitService.autoModeHotkey) {
      addHandler(pitService.autoModeHotkey, (event) => {
        if (event.state === 'Pressed') {
          root.widgetSettings.updateUserSettings('pit-service', {
            autoService: !pitService.autoService,
          });

          // Turning auto back on mid-stop should act, not sit suspended by a
          // manual change made before it was switched on.
          root.pitServiceWidget.setAutoSuspended(false);
        }
      });
    }

    // Writing to the sim stays behind an explicit opt-in, and only ever runs
    // from a key press — never from a telemetry transition.
    if (pitService.enableCommands) {
      const widget = root.pitServiceWidget;

      const pitCommands: Array<[string, () => Promise<void>]> = [
        [pitService.applyOrderHotkey, () => widget.sendPlannedOrder()],
        [pitService.clearOrderHotkey, () => widget.sendClearOrder()],
        [pitService.fuelHotkey, () => widget.toggleFuel()],
        [pitService.tiresAllHotkey, () => widget.toggleAllTires()],
        [pitService.tireLfHotkey, () => widget.toggleTire('lf')],
        [pitService.tireRfHotkey, () => widget.toggleTire('rf')],
        [pitService.tireLrHotkey, () => widget.toggleTire('lr')],
        [pitService.tireRrHotkey, () => widget.toggleTire('rr')],
        [pitService.fastRepairHotkey, () => widget.toggleFastRepair()],
        [pitService.windshieldHotkey, () => widget.toggleWindshield()],
      ];

      for (const [shortcut, run] of pitCommands) {
        addHandler(shortcut, (event) => {
          if (event.state === 'Pressed') {
            void run();
          }
        });
      }
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
