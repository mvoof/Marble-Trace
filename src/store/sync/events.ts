import { runInAction } from 'mobx';
import { emit, emitTo, listen, UnlistenFn } from '@tauri-apps/api/event';
import type { UnitSystem } from '@/types';
import type {
  LayoutMonitor,
  SessionContext,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import type { AppLanguage } from '@store/settings/app-settings.store';
import type { BindingMap } from '@store/hotkeys/binding-types';
import { listOverlayWindowLabels, monitorLabel } from './overlay-labels';

const MAIN = 'main';

type SessionLayoutMap = Record<SessionContext, string | null>;

// Widget lists always travel with the monitor they belong to. Without it an
// edit made on one screen would overwrite the widgets of another.
export interface MonitorWidgetsPayload {
  monitorName: string;
  widgets: WidgetDefaultConfig[];
  /**
   * The layout's monitors. An overlay window needs them to decide which
   * widgets are its own — the test is a centre point against monitor bounds,
   * so a window that only knew its own name could not place anything.
   */
  monitors?: LayoutMonitor[];
}

// Fan-out to every open overlay window. During startup the main window can
// react before any overlay exists, which makes Tauri log "event emitted but no
// listeners found"; overlays hydrate the same values from disk on their own
// boot, so skipping an emit before they are up is harmless.
const emitToOverlays = async (event: string, payload: unknown) => {
  const labels = await listOverlayWindowLabels();

  for (const label of labels) {
    await emitTo(label, event, payload);
  }
};

export const setupMainListeners = async (
  root: RootStore
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(
    await listen<boolean>('drag-mode-changed', (e) => {
      runInAction(() => root.appSettings.setDragMode(e.payload));
    })
  );

  unlistens.push(await listenPitServiceAutoSuspended(root));
  unlistens.push(await listenPitServiceHalvesTakenOver(root));

  return unlistens;
};

/**
 * Auto mode stands down for the rest of a stop as soon as the driver touches
 * the order — and that touch can land in either window: the checkboxes are
 * clicked in the overlay, the hotkeys are registered in main. Both windows
 * mirror the flag so the AUTO / MANUAL badge and the pit entry trigger agree.
 */
const listenPitServiceAutoSuspended = (root: RootStore) =>
  listen<boolean>('pit-service-auto-suspended', (e) => {
    runInAction(() => root.pitServiceWidget.setAutoSuspended(e.payload));
  });

/**
 * Which halves of the order are already settled, for the same reason: a fuel
 * nudge from a hotkey in main and a tire checkbox clicked in the overlay each
 * claim one half, and both windows draw the badges off the result.
 */
const listenPitServiceHalvesTakenOver = (root: RootStore) =>
  listen<HalvesTakenOver>('pit-service-halves-taken-over', (e) => {
    runInAction(() =>
      root.pitServiceWidget.setHalvesTakenOver(e.payload.fuel, e.payload.tires)
    );
  });

export const setupOverlayListeners = async (
  root: RootStore
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(
    await listen<boolean>('drag-mode-changed', (e) => {
      runInAction(() => root.appSettings.setDragMode(e.payload));
    })
  );

  unlistens.push(
    await listen<boolean>('hide-all-widgets-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.hideAllWidgets = e.payload;
      });
    })
  );

  unlistens.push(
    await listen<boolean>('hide-widgets-when-game-closed-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.hideWidgetsWhenGameClosed = e.payload;
      });
    })
  );

  unlistens.push(
    await listen<UnitSystem>('units-changed', (e) => {
      runInAction(() => root.units.setSystem(e.payload));
    })
  );

  unlistens.push(
    await listen<number>('steering-lock-changed', (e) => {
      runInAction(() => root.appSettings.setSteeringLock(e.payload));
    })
  );

  unlistens.push(
    await listen<AppLanguage>('language-changed', (e) => {
      root.appSettings.setLanguage(e.payload);
    })
  );

  // The overlay renders the chat, so it needs the source-level filters even
  // though it never opens a connection itself.
  unlistens.push(
    await listen<StreamChatFilters>('stream-chat-filters-changed', (e) => {
      runInAction(() => {
        root.appSettings.setStreamChatHideCommands(e.payload.hideCommands);
        root.appSettings.setStreamChatIgnoredBots(e.payload.ignoredBots);
      });
    })
  );

  // The connectors live in main, so only main knows when the feed was shut
  // down; the overlay drops its own buffer on that signal.
  unlistens.push(
    await listen('stream-chat-cleared', () => {
      runInAction(() => root.chat.reset());
    })
  );

  unlistens.push(
    await listen<MonitorWidgetsPayload>('widget-settings-updated', (e) => {
      if (e.payload.monitorName !== root.widgetSettings.ownMonitorName) return;

      if (e.payload.monitors) {
        root.widgetSettings.applyMonitorsSync(e.payload.monitors);
      }

      root.widgetSettings.applySettingsSync(e.payload.widgets);
    })
  );

  unlistens.push(
    await listen<number>('standings-class-index-changed', (e) => {
      runInAction(() => {
        root.standingsWidget.activeClassIndex = e.payload;
      });
    })
  );

  // Scroll travels as a delta rather than an offset: only the overlay knows how
  // many rows fit and how long the target list is, so only it can clamp.
  unlistens.push(
    await listen<number>('standings-scroll', (e) => {
      runInAction(() => root.standingsWidget.scrollByRows(e.payload));
    })
  );

  unlistens.push(
    await listen('pit-service-toggle', () => {
      runInAction(() => root.pitServiceWidget.toggleManualShow());
    })
  );

  // The key was pressed in main, where the runner lives; the panel it should
  // pop up renders here.
  unlistens.push(
    await listen('pit-service-reveal', () => {
      runInAction(() => root.pitServiceWidget.revealFromCommand());
    })
  );

  unlistens.push(
    await listen<boolean>('interact-mode-changed', (e) => {
      runInAction(() => {
        root.appSettings.interactMode = e.payload;
      });
    })
  );

  unlistens.push(await listenPitServiceAutoSuspended(root));
  unlistens.push(await listenPitServiceHalvesTakenOver(root));

  unlistens.push(
    await listen<SessionLayoutMap>('session-layouts-changed', (e) => {
      runInAction(() => {
        root.widgetSettings.sessionLayouts = e.payload;
      });
    })
  );

  unlistens.push(
    await listen<BindingMap>('bindings-changed', (e) => {
      runInAction(() => root.bindings.applyBindings(e.payload));
    })
  );

  unlistens.push(
    await listen<boolean>('auto-switch-layouts-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.autoSwitchLayouts = e.payload;
      });
    })
  );

  return unlistens;
};

export const emitDragMode = (val: boolean) => emit('drag-mode-changed', val);

export const emitHideAllWidgets = (val: boolean) =>
  emitToOverlays('hide-all-widgets-changed', val);

export const emitHideWidgetsWhenGameClosed = (val: boolean) =>
  emitToOverlays('hide-widgets-when-game-closed-changed', val);

export const emitUnitsChanged = (system: UnitSystem) =>
  emitToOverlays('units-changed', system);

export const emitSteeringLockChanged = (degrees: number) =>
  emitToOverlays('steering-lock-changed', degrees);

export const emitLanguageChanged = (language: AppLanguage) =>
  emitToOverlays('language-changed', language);

export interface StreamChatFilters {
  hideCommands: boolean;
  ignoredBots: string;
}

export const emitStreamChatFilters = (filters: StreamChatFilters) =>
  emitToOverlays('stream-chat-filters-changed', filters);

export const emitStreamChatCleared = () =>
  emitToOverlays('stream-chat-cleared', null);

export const emitStandingsClassIndex = (index: number) =>
  emitToOverlays('standings-class-index-changed', index);

export const emitPitServiceToggle = () =>
  emitToOverlays('pit-service-toggle', null);

// Broadcast rather than targeted: either window can be the one that suspends.
export const emitPitServiceReveal = () =>
  emitToOverlays('pit-service-reveal', null);

export const emitPitServiceAutoSuspended = (suspended: boolean) =>
  emit('pit-service-auto-suspended', suspended);

export interface HalvesTakenOver {
  fuel: boolean;
  tires: boolean;
}

export const emitPitServiceHalvesTakenOver = (halves: HalvesTakenOver) =>
  emit('pit-service-halves-taken-over', halves);

export const emitStandingsScroll = (delta: number) =>
  emitToOverlays('standings-scroll', delta);

export const emitInteractMode = (active: boolean) =>
  emitToOverlays('interact-mode-changed', active);

/**
 * Pushes the active layout to every open overlay window.
 *
 * Every window receives the whole widget list, not a per-monitor slice: a
 * widget dragged over a monitor edge has to appear on the neighbour, and only
 * the receiving window can decide that, by testing centre points against its
 * own bounds. The live widgets are sent rather than the layout's stored copy —
 * the layout is only written back on the debounced commit, which would lag a
 * drag by half a second.
 */
export const emitActiveLayoutToOverlays = async (root: RootStore) => {
  const layout = root.widgetSettings.activeLayout;

  if (!layout) return;

  const widgets = root.widgetSettings.allWidgets;
  const labels = await listOverlayWindowLabels();

  for (const monitor of layout.monitors) {
    const label = monitorLabel(monitor.name);

    if (!labels.includes(label)) continue;

    await emitTo(label, 'widget-settings-updated', {
      monitorName: monitor.name,
      widgets,
      monitors: layout.monitors,
    } satisfies MonitorWidgetsPayload);
  }
};

export const emitWidgetSettingsToMain = (payload: MonitorWidgetsPayload) =>
  emitTo(MAIN, 'widget-settings-updated', payload);

export const emitSessionLayoutsChanged = (sessionLayouts: SessionLayoutMap) =>
  emitToOverlays('session-layouts-changed', sessionLayouts);

export const emitAutoSwitchLayoutsChanged = (val: boolean) =>
  emitToOverlays('auto-switch-layouts-changed', val);

// The overlay never dispatches an action, but it does print the key that leaves
// interact mode, so a rebind made in main has to reach it.
export const emitBindingsChanged = (bindings: BindingMap) =>
  emitToOverlays('bindings-changed', bindings);
