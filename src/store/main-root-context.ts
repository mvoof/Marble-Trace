import { createContext, use } from 'react';
import type { MainRoot } from './main-root';

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
