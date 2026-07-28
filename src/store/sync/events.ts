import { runInAction } from 'mobx';
import { emit, emitTo, listen, UnlistenFn } from '@tauri-apps/api/event';
import type { UnitSystem } from '@/types';
import type {
  SessionContext,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import type { AppLanguage } from '@store/settings/app-settings.store';
import { listOverlayWindowLabels, monitorLabel } from './overlay-labels';

const MAIN = 'main';

type SessionLayoutMap = Record<SessionContext, string | null>;

// Widget lists always travel with the monitor they belong to. Without it an
// edit made on one screen would overwrite the widgets of another.
export interface MonitorWidgetsPayload {
  monitorName: string;
  widgets: WidgetDefaultConfig[];
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

  return unlistens;
};

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

  unlistens.push(
    await listen<MonitorWidgetsPayload>('widget-settings-updated', (e) => {
      if (e.payload.monitorName !== root.widgetSettings.ownMonitorName) return;

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
    await listen<boolean>('interact-mode-changed', (e) => {
      runInAction(() => {
        root.appSettings.interactMode = e.payload;
      });
    })
  );

  unlistens.push(
    await listen<SessionLayoutMap>('session-layouts-changed', (e) => {
      runInAction(() => {
        root.widgetSettings.sessionLayouts = e.payload;
      });
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

export const emitStandingsClassIndex = (index: number) =>
  emitToOverlays('standings-class-index-changed', index);

export const emitStandingsScroll = (delta: number) =>
  emitToOverlays('standings-scroll', delta);

export const emitInteractMode = (active: boolean) =>
  emitToOverlays('interact-mode-changed', active);

// Pushes the active layout to every open overlay window, each getting only its
// own monitor's widgets. The monitor being edited receives the live widgets:
// its config is only written back on the debounced commit, so reading it here
// would lag a drag by half a second.
export const emitActiveLayoutToOverlays = async (root: RootStore) => {
  const layout = root.widgetSettings.activeLayout;

  if (!layout) return;

  const editedName = layout.activeMonitorName;
  const labels = await listOverlayWindowLabels();

  for (const [monitorName, config] of Object.entries(layout.monitorConfigs)) {
    const label = monitorLabel(monitorName);

    if (!labels.includes(label)) continue;

    const widgets =
      monitorName === editedName
        ? root.widgetSettings.allWidgets
        : config.widgets;

    await emitTo(label, 'widget-settings-updated', {
      monitorName,
      widgets,
    } satisfies MonitorWidgetsPayload);
  }
};

export const emitWidgetSettingsToMain = (payload: MonitorWidgetsPayload) =>
  emitTo(MAIN, 'widget-settings-updated', payload);

export const emitSessionLayoutsChanged = (sessionLayouts: SessionLayoutMap) =>
  emitToOverlays('session-layouts-changed', sessionLayouts);

export const emitAutoSwitchLayoutsChanged = (val: boolean) =>
  emitToOverlays('auto-switch-layouts-changed', val);
