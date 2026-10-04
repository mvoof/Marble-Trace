import type { LayoutGestureStores } from '@store/settings/layout-gestures';
import { createContext, use } from 'react';
import type { AppWindowStores } from './app-window-stores';
import type { RendererCore } from './renderer-core';

/**
 * Hooks onto the stores every renderer holds. The context is typed
 * `RendererCore`, so a store that only the main window builds is not on it —
 * reaching for one from a widget or the overlay is a type error, not a lint.
 * Those live in `main-root-context.ts`; the banner window's in
 * `hud-root-context.ts`.
 *
 * A preview (layout canvas, widget preview, the overlay's drag-mode sample
 * session, Storybook) overrides this context alone, with a bare
 * `RendererCore({ skipInit: true })`.
 */
export const RendererCoreContext = createContext<RendererCore | null>(null);

/**
 * The two stores both app windows hold — see `AppWindowStores`. Provided by
 * the overlay and the main window, never by a remote screen.
 */
export const AppWindowContext = createContext<AppWindowStores | null>(null);

export const useStore = (): RendererCore => {
  const context = use(RendererCoreContext);

  if (!context) {
    throw new Error('Missing RendererCoreContext provider');
  }

  return context;
};

const useAppWindow = (): AppWindowStores => {
  const context = use(AppWindowContext);

  if (!context) {
    throw new Error('Missing AppWindowContext provider');
  }

  return context;
};

export const useBindingsStore = () => useAppWindow().bindings;
export const useSettingsPanelUiStore = () => useAppWindow().settingsPanelUi;
export const usePlayerStore = () => useStore().player;
export const useCarsStore = () => useStore().cars;
export const useSessionStore = () => useStore().session;
export const useEnvironmentStore = () => useStore().environment;
export const useSimPerfStore = () => useStore().simPerf;
export const useBackendComputedStore = () => useStore().backendComputed;
export const useSimStore = () => useStore().sim;
export const useFlagsStore = () => useStore().flags;
export const usePaceCarStore = () => useStore().paceCar;
export const useIncidentsWidgetStore = () => useStore().incidentsWidget;

export const useRadarWidgetStore = () => useStore().radar;
export const usePlayerPositionStore = () => useStore().playerPosition;
export const usePitServiceWidgetStore = () => useStore().pitServiceWidget;
export const useTrackMapWidgetStore = () => useStore().trackMapWidget;
export const useChatStore = () => useStore().chat;
export const useLiveWidgetsStore = () => useStore().liveWidgets;
export const useWidgetDefaultsStore = () => useStore().widgetDefaults;
export const useLayoutsStore = () => useStore().layouts;

/**
 * The two sides a layout gesture holds — see `layout-gestures.ts`. Handed out
 * together so a call site spells the coordination once rather than assembling
 * it from two hooks.
 */
export const layoutGestureStores = (
  root: RendererCore
): LayoutGestureStores => ({
  records: root.layouts,
  widgetMap: root.liveWidgets,
});

export const useLayoutGestureStores = (): LayoutGestureStores =>
  layoutGestureStores(useStore());
export const useSettingsMutationLog = () => useStore().settingsMutations;
export const useAppSettingsStore = () => useStore().appSettings;
export const useUnitsStore = () => useStore().units;
export const useWidgetAutoHideStore = () => useStore().widgetAutoHide;
