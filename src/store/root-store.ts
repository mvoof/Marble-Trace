import { TelemetryStore } from './iracing/telemetry.store';
import { BackendComputedStore } from './iracing/computed.store';
import { TelemetryConnectionStore } from './iracing/telemetry-connection.store';
import { DeltaStore } from './iracing/delta.store';
import { FlagsStore } from './flags.store';
import { WidgetSettingsStore } from './widget-settings.store';
import { AppSettingsStore } from './app-settings.store';
import { UnitsStore } from './units.store';
import { WidgetAutoHideStore } from './widget-auto-hide.store';

export class RootStore {
  telemetry: TelemetryStore;
  backendComputed: BackendComputedStore;
  telemetryConnection: TelemetryConnectionStore;
  lap: DeltaStore;
  flags: FlagsStore;
  widgetSettings: WidgetSettingsStore;
  appSettings: AppSettingsStore;
  units: UnitsStore;
  widgetAutoHide: WidgetAutoHideStore;

  constructor(options?: { skipInit?: boolean }) {
    this.telemetry = new TelemetryStore();
    this.backendComputed = new BackendComputedStore(this);
    this.lap = new DeltaStore(this);
    this.widgetSettings = new WidgetSettingsStore();
    this.appSettings = new AppSettingsStore();
    this.units = new UnitsStore();
    this.flags = new FlagsStore(this);
    this.telemetryConnection = new TelemetryConnectionStore(this);
    this.widgetAutoHide = new WidgetAutoHideStore();

    if (!options?.skipInit) {
      this.flags.init();
      this.telemetryConnection.init();
      this.appSettings.init();
    }
  }
}
