import { useMemo, type Context, type ReactNode } from 'react';

import { PreviewCore, type RendererCore } from '@store/roots/renderer-core';
import type { MainRoot } from '@store/roots/main-root';
import type { AppWindowStores } from '@store/roots/app-window-stores';
import { RendererCoreContext } from '@store/roots/root-store-context';
import { MainRootContext } from '@store/roots/main-root-context';
import { PlayerContext } from '@store/data/player-context';
import { CarsContext } from '@store/data/cars-context';
import { SessionContext } from '@store/data/session-context';
import { EnvironmentContext } from '@store/data/environment-context';
import { SimPerfContext } from '@store/data/sim-perf-context';
import { BackendComputedContext } from '@store/data/computed-context';
import { ChatContext } from '@store/data/chat-context';
import { PlayerPositionContext } from '@store/data/player-position-context';
import { SimContext } from '@store/sim/sim-context';
import { FlagsContext } from '@store/widgets/flags/flags-context';
import { IncidentsWidgetContext } from '@store/widgets/incidents/incidents-context';
import { RadarWidgetContext } from '@store/widgets/radar/radar-context';
import { PitServiceWidgetContext } from '@store/widgets/pit-service/pit-service-context';
import { TrackMapWidgetContext } from '@store/widgets/track-map/track-map-context';
import { TrackRotationContext } from '@store/widgets/track-map/track-rotation-context';
import { LiveWidgetsContext } from '@store/layout/live-widgets-context';
import { MainLiveWidgetsContext } from '@store/layout/main-live-widgets-context';
import { WidgetDefaultsContext } from '@store/layout/widget-defaults-context';
import { LayoutsContext } from '@store/layout/layouts-context';
import { SettingsMutationLogContext } from '@store/layout/mutation-log-context';
import { LayoutEditorContext } from '@store/layout/layout-editor-context';
import { AppSettingsContext } from '@store/settings/app-settings-context';
import { UnitsContext } from '@store/settings/units-context';
import { WidgetAutoHideContext } from '@store/widget-runtime/widget-auto-hide-context';
import { SettingsPanelUiContext } from '@store/widget-runtime/settings-panel-ui-context';
import { BindingsContext } from '@store/hotkeys/bindings-context';
import { BindingsUiContext } from '@store/hotkeys/bindings-ui-context';
import { DeviceInputContext } from '@store/hotkeys/device-input-context';
import { FpsDiagnosticsContext } from '@store/diagnostics/fps-diagnostics-context';
import { DiagnosticsExportContext } from '@store/diagnostics/diagnostics-export-context';
import { TelemetryInspectorContext } from '@store/diagnostics/telemetry-inspector-context';
import { TwitchAuthContext } from '@store/integrations/twitch-auth-context';
import { CompanionAppsContext } from '@store/integrations/companion-apps-context';
import { RemoteDevicesContext } from '@store/remote/remote-devices-context';
import { WidgetHostContext } from '@ui/widgets/widget-host-context';
import {
  PreviewWorldContext,
  type PreviewWorld,
} from '@/preview/preview-host-context';

/** One context and the store it holds — typed together, so a wrong store is a compile error here. */
interface ProvidedStore {
  StoreContext: Context<unknown>;
  value: unknown;
}

const provide = <Store,>(
  StoreContext: Context<Store | null>,
  value: Store
): ProvidedStore => ({ StoreContext: StoreContext as Context<unknown>, value });

const coreStores = (core: RendererCore): ProvidedStore[] => [
  provide(RendererCoreContext, core),
  provide(WidgetHostContext, core),
  provide(PlayerContext, core.player),
  provide(CarsContext, core.cars),
  provide(SessionContext, core.session),
  provide(EnvironmentContext, core.environment),
  provide(SimPerfContext, core.simPerf),
  provide(BackendComputedContext, core.backendComputed),
  provide(ChatContext, core.chat),
  provide(PlayerPositionContext, core.playerPosition),
  provide(SimContext, core.sim),
  provide(FlagsContext, core.flags),
  provide(IncidentsWidgetContext, core.incidentsWidget),
  provide(RadarWidgetContext, core.radar),
  provide(PitServiceWidgetContext, core.pitServiceWidget),
  provide(TrackMapWidgetContext, core.trackMapWidget),
  provide(LiveWidgetsContext, core.liveWidgets),
  provide(WidgetDefaultsContext, core.widgetDefaults),
  provide(LayoutsContext, core.layouts),
  provide(SettingsMutationLogContext, core.settingsMutations),
  provide(AppSettingsContext, core.appSettings),
  provide(UnitsContext, core.units),
  provide(WidgetAutoHideContext, core.widgetAutoHide),
];

const appWindowStores = (stores: AppWindowStores): ProvidedStore[] => [
  provide(BindingsContext, stores.bindings),
  provide(SettingsPanelUiContext, stores.settingsPanelUi),
];

/** A fresh sample world for a page that draws widgets over preview data. */
const createPreviewWorld = (): PreviewWorld => {
  const core = new PreviewCore();

  const Provide = ({ children }: { children: ReactNode }) => (
    <CoreProvider core={core}>{children}</CoreProvider>
  );

  return { core, Provide };
};

const mainStores = (root: MainRoot): ProvidedStore[] => [
  provide(MainRootContext, root),
  provide(MainLiveWidgetsContext, root.liveWidgets),
  provide(LayoutEditorContext, root.layoutEditor),
  provide(CompanionAppsContext, root.companionApps),
  provide(TwitchAuthContext, root.twitchAuth),
  provide(DeviceInputContext, root.deviceInput),
  provide(BindingsUiContext, root.bindingsUi),
  provide(RemoteDevicesContext, root.remoteDevices),
  provide(FpsDiagnosticsContext, root.fpsDiagnostics),
  provide(DiagnosticsExportContext, root.diagnosticsExport),
  provide(TelemetryInspectorContext, root.telemetryInspector),
  provide(TrackRotationContext, root.trackRotation),
  provide(PreviewWorldContext, createPreviewWorld),
];

const StoresProvider = ({
  stores,
  children,
}: {
  stores: ProvidedStore[];
  children: ReactNode;
}) =>
  stores.reduceRight<ReactNode>(
    (inner, { StoreContext, value }) => (
      <StoreContext.Provider value={value}>{inner}</StoreContext.Provider>
    ),
    children
  );

/**
 * Puts every store of a core under its own context. A preview renders it with
 * its `PreviewCore`, which then answers every core hook below it.
 */
export const CoreProvider = ({
  core,
  children,
}: {
  core: RendererCore;
  children: ReactNode;
}) => {
  const stores = useMemo(() => coreStores(core), [core]);

  return <StoresProvider stores={stores}>{children}</StoresProvider>;
};

/** The two stores both app windows hold — see `AppWindowStores`. */
export const AppWindowProvider = ({
  stores,
  children,
}: {
  stores: AppWindowStores;
  children: ReactNode;
}) => {
  const provided = useMemo(() => appWindowStores(stores), [stores]);

  return <StoresProvider stores={provided}>{children}</StoresProvider>;
};

/**
 * The main window's whole root: the core, the app-window stores and the ones
 * only main builds. An overlay or a remote screen renders no `MainProvider`,
 * so a main-only hook there throws on first render.
 */
export const MainProvider = ({
  root,
  children,
}: {
  root: MainRoot;
  children: ReactNode;
}) => {
  const provided = useMemo(
    () => [...coreStores(root), ...appWindowStores(root), ...mainStores(root)],
    [root]
  );

  return <StoresProvider stores={provided}>{children}</StoresProvider>;
};
