import { createContext, useContext } from 'react';
import type { RootStore } from './root-store';

export const RootStoreContext = createContext<RootStore | null>(null);

export const useRootStore = (): RootStore => {
  const store = useContext(RootStoreContext);

  if (!store) {
    throw new Error('Missing RootStoreProvider');
  }

  return store;
};

export const useTelemetryStore = () => useRootStore().telemetry;
export const useBackendComputedStore = () => useRootStore().backendComputed;
export const useTelemetryConnectionStore = () =>
  useRootStore().telemetryConnection;
export const useFlagsStore = () => useRootStore().flags;
export const useWidgetSettingsStore = () => useRootStore().widgetSettings;
export const useAppSettingsStore = () => useRootStore().appSettings;
export const useUnitsStore = () => useRootStore().units;
export const useWidgetAutoHideStore = () => useRootStore().widgetAutoHide;
