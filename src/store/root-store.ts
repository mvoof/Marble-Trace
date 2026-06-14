import { BackendComputedStore } from './data/computed.store';
import { SimStore } from './sim/sim.store';
import { FlagsStore } from './widgets/flags.widget';
import { RadarWidgetStore } from './widgets/radar.widget';
import { StandingsWidgetStore } from './widgets/standings.widget';
import { TrackMapWidgetStore } from './widgets/track-map.widget';
import { WidgetSettingsStore } from './settings/widget-settings.store';
import { AppSettingsStore } from './settings/app-settings.store';
import { UnitsStore } from './settings/units.store';
import { WidgetAutoHideStore } from './widgets/widget-auto-hide.store';
import { PlayerStore } from './data/player.store';
import { CarsStore } from './data/cars.store';
import { SessionStore } from './data/session.store';
import { EnvironmentStore } from './data/environment.store';

export class RootStore {
  player: PlayerStore;
  cars: CarsStore;
  session: SessionStore;
  environment: EnvironmentStore;
  backendComputed: BackendComputedStore;
  sim: SimStore;
  flags: FlagsStore;
  radar: RadarWidgetStore;
  standingsWidget: StandingsWidgetStore;
  trackMapWidget: TrackMapWidgetStore;
  widgetSettings: WidgetSettingsStore;
  appSettings: AppSettingsStore;
  units: UnitsStore;
  widgetAutoHide: WidgetAutoHideStore;

  constructor(options?: { skipInit?: boolean }) {
    this.player = new PlayerStore();
    this.cars = new CarsStore();
    this.session = new SessionStore();
    this.environment = new EnvironmentStore();
    this.backendComputed = new BackendComputedStore();
    this.widgetSettings = new WidgetSettingsStore(this);
    this.appSettings = new AppSettingsStore();
    this.units = new UnitsStore();
    this.flags = new FlagsStore(this);
    this.radar = new RadarWidgetStore(this);
    this.standingsWidget = new StandingsWidgetStore(this);
    this.trackMapWidget = new TrackMapWidgetStore();
    this.sim = new SimStore(this);
    this.widgetAutoHide = new WidgetAutoHideStore();

    if (!options?.skipInit) {
      this.flags.init();
      this.radar.init();
      this.sim.init();
      this.appSettings.init();
    }
  }
}
