import { runInAction } from 'mobx';
import { emit, emitTo, listen, UnlistenFn } from '@tauri-apps/api/event';
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import type { UnitSystem } from '@/types';
import type {
  SessionContext,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import type { AppLanguage } from '@store/settings/app-settings.store';
import { positionOverlayToMonitor } from './position-overlay';

const MAIN = 'main';
const OVERLAY = 'overlay';

type SessionLayoutMap = Record<SessionContext, string | null>;

// True once the overlay window exists. During startup the main window can react
// before the overlay has registered its listeners, which makes Tauri log "event
// emitted but no listeners found". The overlay hydrates the same values from
// disk on its own boot, so skipping an emit before it's up is harmless.
const isOverlayReady = async () => {
  const windows = await getAllWebviewWindows();

  return windows.some((window) => window.label === OVERLAY);
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
    await listen<AppLanguage>('language-changed', (e) => {
      root.appSettings.setLanguage(e.payload);
    })
  );

  unlistens.push(
    await listen<WidgetDefaultConfig[]>('widget-settings-updated', (e) => {
      root.widgetSettings.applySettingsSync(e.payload);
    })
  );

  unlistens.push(
    await listen<number>('standings-class-index-changed', (e) => {
      runInAction(() => {
        root.standingsWidget.activeClassIndex = e.payload;
      });
    })
  );

  unlistens.push(
    await listen<string | null>('overlay-monitor-changed', (e) => {
      void positionOverlayToMonitor(e.payload, root);
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

export const emitHideAllWidgets = async (val: boolean) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'hide-all-widgets-changed', val);
  }
};

export const emitHideWidgetsWhenGameClosed = async (val: boolean) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'hide-widgets-when-game-closed-changed', val);
  }
};

export const emitUnitsChanged = async (system: UnitSystem) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'units-changed', system);
  }
};

export const emitLanguageChanged = async (language: AppLanguage) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'language-changed', language);
  }
};

export const emitStandingsClassIndex = async (index: number) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'standings-class-index-changed', index);
  }
};

export const emitWidgetSettingsUpdated = async (
  widgets: WidgetDefaultConfig[]
) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'widget-settings-updated', widgets);
  }
};

export const emitWidgetSettingsToMain = (widgets: WidgetDefaultConfig[]) =>
  emitTo(MAIN, 'widget-settings-updated', widgets);

export const emitOverlayMonitorChanged = async (name: string | null) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'overlay-monitor-changed', name);
  }
};

export const emitSessionLayoutsChanged = async (
  sessionLayouts: SessionLayoutMap
) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'session-layouts-changed', sessionLayouts);
  }
};

export const emitAutoSwitchLayoutsChanged = async (val: boolean) => {
  if (await isOverlayReady()) {
    await emitTo(OVERLAY, 'auto-switch-layouts-changed', val);
  }
};
