import { createContext, useContext } from 'react';
import type { RootStore } from './root-store';

export const RootStoreContext = createContext<RootStore | null>(null);

export const useStore = (): RootStore => {
  const context = useContext(RootStoreContext);

  if (!context) {
    throw new Error('Missing RootStoreProvider');
  }

  return context;
};

export const useTelemetryStore = () => useStore().telemetry;
export const useBackendComputedStore = () => useStore().backendComputed;
export const useLapStore = () => useStore().lap;
export const useTelemetryConnectionStore = () => useStore().telemetryConnection;
export const useFlagsStore = () => useStore().flags;
export const useWidgetSettingsStore = () => useStore().widgetSettings;
export const useAppSettingsStore = () => useStore().appSettings;
export const useUnitsStore = () => useStore().units;
export const useWidgetAutoHideStore = () => useStore().widgetAutoHide;
