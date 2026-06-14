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
export const usePlayerStore = () => useStore().player;
export const useCarsStore = () => useStore().cars;
export const useSessionStore = () => useStore().session;
export const useEnvironmentStore = () => useStore().environment;
export const useBackendComputedStore = () => useStore().backendComputed;
export const useSimStore = () => useStore().sim;
export const useFlagsStore = () => useStore().flags;

export const useRadarWidgetStore = () => useStore().radar;
export const useStandingsWidgetStore = () => useStore().standingsWidget;
export const useTrackMapWidgetStore = () => useStore().trackMapWidget;
export const useWidgetSettingsStore = () => useStore().widgetSettings;
export const useAppSettingsStore = () => useStore().appSettings;
export const useUnitsStore = () => useStore().units;
export const useWidgetAutoHideStore = () => useStore().widgetAutoHide;
