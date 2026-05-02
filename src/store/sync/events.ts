import { runInAction } from 'mobx';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import { appSettingsStore } from '../app-settings.store';
import { unitsStore } from '../units.store';
import { widgetSettingsStore } from '../widget-settings.store';
import type { UnitSystem } from '../../types/units';
import type { WidgetConfig } from '../../types/widget-settings';

export const setupOverlayListeners = async (): Promise<UnlistenFn[]> => {
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

  return unlistens;
};

export const emitDragMode = (val: boolean) => emit('drag-mode-changed', val);
export const emitHideAllWidgets = (val: boolean) =>
  emit('hide-all-widgets-changed', val);
export const emitHideWidgetsWhenGameClosed = (val: boolean) =>
  emit('hide-widgets-when-game-closed-changed', val);
export const emitUnitsChanged = (system: UnitSystem) =>
  emit('units-changed', system);
export const emitStandingsClassIndex = (index: number) =>
  emit('standings-class-index-changed', index);
export const emitTrackMapForceStartPending = (pending: boolean) =>
  emit('track-map:force-start-pending-changed', pending);
export const emitWidgetSettingsUpdated = (widgets: WidgetConfig[]) =>
  emit('widget-settings-updated', widgets);
