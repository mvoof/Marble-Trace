import { createContext, use } from 'react';
import type { RootStore } from './root-store';

export const RootStoreContext = createContext<RootStore | null>(null);

export const useStore = (): RootStore => {
  const context = use(RootStoreContext);

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
export const usePaceCarStore = () => useStore().paceCar;

export const useRadarWidgetStore = () => useStore().radar;
export const useStandingsWidgetStore = () => useStore().standingsWidget;
export const usePitServiceWidgetStore = () => useStore().pitServiceWidget;
export const useTrackMapWidgetStore = () => useStore().trackMapWidget;
export const useDrivingCoachWidgetStore = () => useStore().drivingCoachWidget;
export const useCoachWidgetStore = () => useStore().coachWidget;
export const useInputTraceWidgetStore = () => useStore().inputTraceWidget;
export const useChatStore = () => useStore().chat;
export const useStreamChatWidgetStore = () => useStore().streamChatWidget;
export const useTwitchAuthStore = () => useStore().twitchAuth;
export const useWidgetSettingsStore = () => useStore().widgetSettings;
export const useWidgetDefaultsStore = () => useStore().widgetDefaults;
export const useLayoutsStore = () => useStore().layouts;
export const useAppSettingsStore = () => useStore().appSettings;
export const useUnitsStore = () => useStore().units;
export const useWidgetAutoHideStore = () => useStore().widgetAutoHide;
export const useBindingsStore = () => useStore().bindings;
export const useBindingsUiStore = () => useStore().bindingsUi;
export const useDeviceInputStore = () => useStore().deviceInput;
export const useSettingsPanelUiStore = () => useStore().settingsPanelUi;

export const useRemoteDevicesStore = () => useStore().remoteDevices;
