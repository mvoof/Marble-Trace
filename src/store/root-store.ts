import { BackendComputedStore } from './data/computed.store';
import { SimStore } from './sim/sim.store';
import { FlagsStore } from './widgets/flags.widget';
import { IncidentsWidgetStore } from './widgets/incidents.widget';
import { PaceCarStore } from './widgets/pace-car.widget';
import { RadarWidgetStore } from './widgets/radar.widget';
import { CloseBattleWidgetStore } from '@ui/widgets/CloseBattleWidget/close-battle.widget';
import { PitServiceWidgetStore } from '@ui/widgets/PitServiceWidget/pit-service.widget';
import { StandingsWidgetStore } from './widgets/standings.widget';
import { TrackMapWidgetStore } from '@ui/widgets/TrackMapWidget/track-map.widget';
import { DrivingCoachWidgetStore } from '@ui/widgets/CoachWidget/driving-coach.widget';
import { CoachWidgetStore } from '@ui/widgets/CoachWidget/coach.widget';
import { InputTraceWidgetStore } from '@ui/widgets/InputTraceWidget/input-trace.widget';
import { WidgetSettingsStore } from './settings/widget-settings.store';
import { WidgetDefaultsStore } from './settings/widget-defaults.store';
import type { LayoutsStore } from './settings/layouts.store';
import { AppSettingsStore } from './settings/app-settings.store';
import { UnitsStore } from './settings/units.store';
import { WidgetAutoHideStore } from './widgets/widget-auto-hide.store';
import { PlayerStore } from './data/player.store';
import { CarsStore } from './data/cars.store';
import { SessionStore } from './data/session.store';
import { EnvironmentStore } from './data/environment.store';
import { SimPerfStore } from './data/sim-perf.store';
import { FpsDiagnosticsStore } from './diagnostics/fps-diagnostics.store';
import { DiagnosticsHudStore } from './diagnostics/diagnostics-hud.store';
import { DiagnosticsExportStore } from './diagnostics/diagnostics-export.store';
import { TelemetryInspectorStore } from './diagnostics/telemetry-inspector.store';
import { ReferenceLapStore } from './data/reference-lap.store';
import { ChatStore } from './data/chat.store';
import { TwitchAuthStore } from './settings/twitch-auth.store';
import { StreamChatWidgetStore } from '@ui/widgets/StreamChatWidget/stream-chat.widget';
import { BindingsStore } from './hotkeys/bindings.store';
import { ActionRegistry } from '@store/hotkeys/action-registry';
import { DEFAULT_WIDGETS } from '@store/widget-catalog';
import { DeviceInputStore } from './hotkeys/device-input.store';
import { BindingsUiStore } from './hotkeys/bindings-ui.store';
import { RemoteDevicesStore } from './remote/remote-devices.store';
import { SettingsPanelUiStore } from './widgets/settings-panel-ui.store';

export class RootStore {
  player: PlayerStore;
  cars: CarsStore;
  session: SessionStore;
  environment: EnvironmentStore;
  simPerf: SimPerfStore;
  referenceLap: ReferenceLapStore;
  chat: ChatStore;
  backendComputed: BackendComputedStore;
  sim: SimStore;
  flags: FlagsStore;
  paceCar: PaceCarStore;
  incidentsWidget: IncidentsWidgetStore;
  radar: RadarWidgetStore;
  closeBattleWidget: CloseBattleWidgetStore;
  standingsWidget: StandingsWidgetStore;
  pitServiceWidget: PitServiceWidgetStore;
  trackMapWidget: TrackMapWidgetStore;
  drivingCoachWidget: DrivingCoachWidgetStore;
  coachWidget: CoachWidgetStore;
  inputTraceWidget: InputTraceWidgetStore;
  streamChatWidget: StreamChatWidgetStore;
  widgetSettings: WidgetSettingsStore;
  widgetDefaults: WidgetDefaultsStore;
  layouts: LayoutsStore;
  appSettings: AppSettingsStore;
  twitchAuth: TwitchAuthStore;
  units: UnitsStore;
  widgetAutoHide: WidgetAutoHideStore;
  bindings: BindingsStore;
  deviceInput: DeviceInputStore;
  bindingsUi: BindingsUiStore;
  settingsPanelUi: SettingsPanelUiStore;
  remoteDevices: RemoteDevicesStore;
  fpsDiagnostics: FpsDiagnosticsStore;
  diagnosticsHud: DiagnosticsHudStore;
  diagnosticsExport: DiagnosticsExportStore;
  telemetryInspector: TelemetryInspectorStore;

  constructor(options?: { skipInit?: boolean }) {
    this.player = new PlayerStore();
    this.cars = new CarsStore();
    this.session = new SessionStore();
    this.environment = new EnvironmentStore();
    this.simPerf = new SimPerfStore();
    this.referenceLap = new ReferenceLapStore();
    this.chat = new ChatStore();
    this.backendComputed = new BackendComputedStore();
    this.widgetDefaults = new WidgetDefaultsStore();
    this.widgetSettings = new WidgetSettingsStore(this);
    this.layouts = this.widgetSettings.layoutRecords;
    this.appSettings = new AppSettingsStore();
    this.twitchAuth = new TwitchAuthStore(this);
    this.units = new UnitsStore();
    this.flags = new FlagsStore(this);
    this.paceCar = new PaceCarStore(this);
    this.incidentsWidget = new IncidentsWidgetStore(this);
    this.radar = new RadarWidgetStore(this);
    this.closeBattleWidget = new CloseBattleWidgetStore(this);
    this.standingsWidget = new StandingsWidgetStore(this);
    this.pitServiceWidget = new PitServiceWidgetStore(this);
    // A preview store shows a sample track: turning that map must not write an
    // angle to disk under a track id the user never drove.
    this.trackMapWidget = new TrackMapWidgetStore({
      persists: !options?.skipInit,
    });
    this.drivingCoachWidget = new DrivingCoachWidgetStore(this);
    this.coachWidget = new CoachWidgetStore(this);
    this.inputTraceWidget = new InputTraceWidgetStore(this);
    this.streamChatWidget = new StreamChatWidgetStore(this);
    this.sim = new SimStore(this);
    this.widgetAutoHide = new WidgetAutoHideStore();
    this.bindings = new BindingsStore(new ActionRegistry(DEFAULT_WIDGETS));
    this.deviceInput = new DeviceInputStore();
    this.bindingsUi = new BindingsUiStore();
    this.settingsPanelUi = new SettingsPanelUiStore();
    this.remoteDevices = new RemoteDevicesStore();
    this.fpsDiagnostics = new FpsDiagnosticsStore(this);
    this.diagnosticsHud = new DiagnosticsHudStore();
    this.diagnosticsExport = new DiagnosticsExportStore(this);
    this.telemetryInspector = new TelemetryInspectorStore(this);

    if (!options?.skipInit) {
      this.flags.init();
      this.paceCar.init();
      this.radar.init();
      this.closeBattleWidget.init();
      this.sim.init();
      this.appSettings.init();
      this.drivingCoachWidget.init();
      this.coachWidget.init();
      this.streamChatWidget.init();
      this.pitServiceWidget.init();
      void this.chat.init();
      void this.twitchAuth.init();
    }
  }

  // Short-lived stores (widget previews, layout canvas, Storybook) must call
  // this on unmount — their reactions otherwise keep running against telemetry.
  dispose() {
    this.closeBattleWidget.dispose();
    this.fpsDiagnostics.dispose();
    this.twitchAuth.dispose();
    this.streamChatWidget.dispose();
    this.pitServiceWidget.dispose();
    this.chat.dispose();
    this.inputTraceWidget.dispose();
    this.coachWidget.dispose();
    this.standingsWidget.dispose();
    this.flags.dispose();
    this.sim.dispose();
  }
}
