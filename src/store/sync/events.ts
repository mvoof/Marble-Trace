import { runInAction } from 'mobx';
import { emit, emitTo, listen, UnlistenFn } from '@tauri-apps/api/event';
import type { UnitSystem } from '@/types';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';

const MAIN = 'main';
const OVERLAY = 'overlay';

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
    await listen<boolean>('hide-widgets-in-garage-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.hideWidgetsInGarage = e.payload;
      });
    })
  );
  unlistens.push(
    await listen<UnitSystem>('units-changed', (e) => {
      runInAction(() => root.units.setSystem(e.payload));
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
    await listen<number | null>('overlay-monitor-changed', (e) => {
      runInAction(() => root.appSettings.setOverlayMonitorIndex(e.payload));
    })
  );
  return unlistens;
};

export const emitDragMode = (val: boolean) => emit('drag-mode-changed', val);
export const emitHideAllWidgets = (val: boolean) =>
  emitTo(OVERLAY, 'hide-all-widgets-changed', val);
export const emitHideWidgetsWhenGameClosed = (val: boolean) =>
  emitTo(OVERLAY, 'hide-widgets-when-game-closed-changed', val);
export const emitHideWidgetsInGarage = (val: boolean) =>
  emitTo(OVERLAY, 'hide-widgets-in-garage-changed', val);
export const emitUnitsChanged = (system: UnitSystem) =>
  emitTo(OVERLAY, 'units-changed', system);
export const emitStandingsClassIndex = (index: number) =>
  emitTo(OVERLAY, 'standings-class-index-changed', index);
export const emitWidgetSettingsUpdated = (widgets: WidgetDefaultConfig[]) =>
  emitTo(OVERLAY, 'widget-settings-updated', widgets);
export const emitWidgetSettingsToMain = (widgets: WidgetDefaultConfig[]) =>
  emitTo(MAIN, 'widget-settings-updated', widgets);
export const emitOverlayMonitorChanged = (index: number | null) =>
  emitTo(OVERLAY, 'overlay-monitor-changed', index);
