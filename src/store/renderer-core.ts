import { BackendComputedStore } from './data/computed.store';
import { SimStore } from './sim/sim.store';
import { FlagsStore } from './widgets/flags.widget';
import { IncidentsWidgetStore } from './widgets/incidents.widget';
import { PaceCarStore } from './widgets/pace-car.widget';
import { RadarWidgetStore } from './widgets/radar.widget';
import { CloseBattleWidgetStore } from '@ui/widgets/CloseBattleWidget/close-battle.widget';
import { WheelToWheelWidgetStore } from '@ui/widgets/WheelToWheelWidget/wheel-to-wheel.widget';
import { RelativeWidgetStore } from '@ui/widgets/RelativeWidget/relative.widget';
import { PitServiceWidgetStore } from '@ui/widgets/PitServiceWidget/pit-service.widget';
import { StandingsWidgetStore } from './widgets/standings.widget';
import { TrackMapWidgetStore } from '@ui/widgets/TrackMapWidget/track-map.widget';
import { DrivingCoachWidgetStore } from '@ui/widgets/CoachWidget/driving-coach.widget';
import { CoachWidgetStore } from '@ui/widgets/CoachWidget/coach.widget';
import { InputTraceWidgetStore } from '@ui/widgets/InputTraceWidget/input-trace.widget';
import { EnginePanelWidgetStore } from '@ui/widgets/EnginePanelWidget/engine-panel.widget';
import { LiveWidgetsStore } from './settings/live-widgets.store';
import { WidgetDefaultsStore } from './settings/widget-defaults.store';
import { LayoutsStore } from './settings/layouts.store';
import { SettingsMutationLog } from './settings/mutation-log';
import { AppSettingsStore } from './settings/app-settings.store';
import { UnitsStore } from './settings/units.store';
import { WidgetAutoHideStore } from './widgets/widget-auto-hide.store';
import { PlayerStore } from './data/player.store';
import { CarsStore } from './data/cars.store';
import { SessionStore } from './data/session.store';
import { EnvironmentStore } from './data/environment.store';
import { SimPerfStore } from './data/sim-perf.store';
import { ReferenceLapStore } from './data/reference-lap.store';
import { ChatStore } from './data/chat.store';
import { StreamChatWidgetStore } from '@ui/widgets/StreamChatWidget/stream-chat.widget';

/**
 * The stores every renderer needs: the telemetry data, the sim, the settings
 * projection widgets read, units, and the widget stores. Nothing that only the
 * settings UI uses — that lives on the window roots built over this one
 * (`MainRoot`, `OverlayRoot`, `RemoteRoot`), so an overlay never constructs
 * the editor, the inspector or the chat sign-in, and a component that only
 * holds a `RendererCore` cannot reach them by type.
 *
 * A preview (layout editor canvas, widget preview, Storybook) is a bare
 * `RendererCore({ skipInit: true })`.
 */
export class RendererCore {
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
  wheelToWheelWidget: WheelToWheelWidgetStore;
  relativeWidget: RelativeWidgetStore;
  standingsWidget: StandingsWidgetStore;
  pitServiceWidget: PitServiceWidgetStore;
  trackMapWidget: TrackMapWidgetStore;
  drivingCoachWidget: DrivingCoachWidgetStore;
  coachWidget: CoachWidgetStore;
  inputTraceWidget: InputTraceWidgetStore;
  enginePanelWidget: EnginePanelWidgetStore;
  streamChatWidget: StreamChatWidgetStore;
  liveWidgets: LiveWidgetsStore;
  widgetDefaults: WidgetDefaultsStore;
  layouts: LayoutsStore;

  /** What every settings write marks itself in — see `SettingsMutationLog`. */
  settingsMutations: SettingsMutationLog;
  appSettings: AppSettingsStore;
  units: UnitsStore;
  widgetAutoHide: WidgetAutoHideStore;

  constructor(options?: { skipInit?: boolean }) {
    this.player = new PlayerStore();
    this.cars = new CarsStore();
    this.session = new SessionStore();
    this.environment = new EnvironmentStore();
    this.simPerf = new SimPerfStore();
    this.referenceLap = new ReferenceLapStore();
    this.chat = new ChatStore();
    this.backendComputed = new BackendComputedStore();
    this.widgetDefaults = new WidgetDefaultsStore(this);
    this.settingsMutations = new SettingsMutationLog();
    // Built in dependency order, so neither needs a deferred reference to the
    // other: the records know nothing, the live map projects the records. The
    // editing session that drives both belongs to the main window (`MainRoot`).
    this.layouts = new LayoutsStore(this.settingsMutations);
    this.liveWidgets = new LiveWidgetsStore(
      this.settingsMutations,
      this.layouts,
      this.widgetDefaults,
      () => this.sim.capabilities
    );
    this.appSettings = new AppSettingsStore();
    this.units = new UnitsStore();
    this.flags = new FlagsStore(this);
    this.paceCar = new PaceCarStore(this);
    this.incidentsWidget = new IncidentsWidgetStore(this);
    this.radar = new RadarWidgetStore(this);
    this.closeBattleWidget = new CloseBattleWidgetStore(this);
    this.wheelToWheelWidget = new WheelToWheelWidgetStore(this);
    this.relativeWidget = new RelativeWidgetStore(this);
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
    this.enginePanelWidget = new EnginePanelWidgetStore(this);
    this.streamChatWidget = new StreamChatWidgetStore(this);
    this.sim = new SimStore(this);
    this.widgetAutoHide = new WidgetAutoHideStore(this);

    if (!options?.skipInit) {
      this.flags.init();
      this.paceCar.init();
      this.radar.init();
      this.closeBattleWidget.init();
      this.wheelToWheelWidget.init();
      this.sim.init();
      this.appSettings.init();
      this.drivingCoachWidget.init();
      this.coachWidget.init();
      this.streamChatWidget.init();
      this.pitServiceWidget.init();
      void this.chat.init();
    }
  }

  // Short-lived stores (widget previews, layout canvas, Storybook) must call
  // this on unmount — their reactions otherwise keep running against telemetry.
  dispose() {
    this.closeBattleWidget.dispose();
    this.wheelToWheelWidget.dispose();
    this.streamChatWidget.dispose();
    this.pitServiceWidget.dispose();
    this.chat.dispose();
    this.inputTraceWidget.dispose();
    this.enginePanelWidget.dispose();
    this.coachWidget.dispose();
    this.standingsWidget.dispose();
    this.flags.dispose();
    this.sim.dispose();
    this.radar.dispose();
  }
}
