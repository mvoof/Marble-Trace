import { createContext, use } from 'react';
import type { MainRoot } from './main-root';
import type { LayoutGestureStores } from './settings/layout-gestures';

/**
 * Hooks onto the stores only the main window builds: the layout editor, the
 * telemetry inspector, diagnostics, companion apps, the chat sign-in, the
 * device list. An overlay or a remote screen provides no `MainRoot`, so a hook
 * from here outside the main window throws on first render — and the overlay
 * and widget folders may not import this file at all (`.oxlintrc.json`).
 */
export const MainRootContext = createContext<MainRoot | null>(null);

export const useMainRoot = (): MainRoot => {
  const context = use(MainRootContext);

  if (!context) {
    throw new Error('Missing MainRootContext provider');
  }

  return context;
};

export const useFpsDiagnosticsStore = () => useMainRoot().fpsDiagnostics;
export const useDiagnosticsExportStore = () => useMainRoot().diagnosticsExport;
export const useTelemetryInspectorStore = () =>
  useMainRoot().telemetryInspector;
export const useTwitchAuthStore = () => useMainRoot().twitchAuth;
export const useLayoutEditorStore = () => useMainRoot().layoutEditor;
export const useCompanionAppsStore = () => useMainRoot().companionApps;
export const useBindingsUiStore = () => useMainRoot().bindingsUi;
export const useDeviceInputStore = () => useMainRoot().deviceInput;
export const useRemoteDevicesStore = () => useMainRoot().remoteDevices;
export const useTrackRotationStore = () => useMainRoot().trackRotation;

/**
 * The two sides a layout gesture holds — see `layout-gestures.ts`. Handed out
 * together so a call site spells the coordination once rather than assembling
 * it from two hooks. Main's alone: a gesture writes the layout.
 */
export const layoutGestureStores = (
  root: Pick<MainRoot, 'layouts' | 'liveWidgets'>
): LayoutGestureStores => ({
  records: root.layouts,
  widgetMap: root.liveWidgets,
});

export const useLayoutGestureStores = (): LayoutGestureStores =>
  layoutGestureStores(useMainRoot());

/** The widget store with its writes — main is the one window that has them. */
export const useMainLiveWidgetsStore = () => useMainRoot().liveWidgets;
