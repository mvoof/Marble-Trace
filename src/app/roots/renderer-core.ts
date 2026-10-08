import { BackendComputedStore } from '@entities/cars/computed.store';
import { SimStore } from '@entities/sim/sim.store';
import { FlagsStore } from '@entities/flags/flags.store';
import { IncidentsWidgetStore } from '@entities/incidents/incidents.store';
import { RadarWidgetStore } from '@entities/radar/radar.store';
import { PitServiceWidgetStore } from '@features/pit-service/pit-service.store';
import { PlayerPositionStore } from '@entities/player/player-position.store';
import {
  SharedWidgetStores,
  WidgetInstanceRegistry,
} from '@entities/widget/widget-instances.store';
import { TrackMapWidgetStore } from '@entities/track/track-map.store';
import {
  LiveWidgetsStore,
  type LiveWidgetsView,
} from '@entities/layout/live-widgets.store';
import { WidgetDefaultsStore } from '@entities/widget/widget-defaults.store';
import { LayoutsStore } from '@entities/layout/layouts.store';
import { SettingsMutationLog } from '@entities/layout/mutation-log.store';
import { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import { UnitsStore } from '@entities/app-settings/units.store';
import { WidgetAutoHideStore } from '@entities/widget/widget-auto-hide.store';
import { PlayerStore } from '@entities/player/player.store';
import { CarsStore } from '@entities/cars/cars.store';
import { SessionStore } from '@entities/session/session.store';
import { EnvironmentStore } from '@entities/environment/environment.store';
import { SimPerfStore } from '@entities/sim-perf/sim-perf.store';
import { ReferenceLapStore } from '@entities/player/reference-lap.store';
import { ChatStore } from '@entities/chat/chat.store';

interface RendererCoreOptions {
  /** A preview: no Tauri channels, nothing persisted, no store started. */
  skipInit?: boolean;
  /**
   * Starts the widget stores as their widgets mount, even under `skipInit` — a
   * remote screen opens no Tauri channel but derives the flags, the radar and
   * every widget's own state from the data it is sent. Defaults to
   * `!skipInit`.
   */
  startsWidgetStores?: boolean;
}

/**
 * The stores every renderer needs: the telemetry data, the sim, the settings
 * projection widgets read, units, and the few widget stores that are one per
 * app — shared by several widget types, or read with no widget mounted (the
 * pit order, the recorded track). A widget's own store is per instance and is
 * declared in its `mount.ts`; it is built when the instance mounts and lives
 * in `widgetInstances`. Nothing here imports a widget. Nothing that only the
 * settings UI uses — that lives on the window roots built over this one
 * (`MainRoot`, `OverlayRoot`, `RemoteRoot`), so an overlay never constructs
 * the editor, the inspector or the chat sign-in, and a component that only
 * holds a `RendererCore` cannot reach them by type.
 *
 * A preview (layout editor canvas, widget preview, Storybook) is a
 * `PreviewCore`, which may write its own settings.
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
  incidentsWidget: IncidentsWidgetStore;
  radar: RadarWidgetStore;
  playerPosition: PlayerPositionStore;

  /** The flags, pace-car and radar stores, started while a widget reads them. */
  sharedWidgetStores: SharedWidgetStores;

  /** The per-instance stores of the widgets mounted against this core. */
  widgetInstances: WidgetInstanceRegistry;

  /**
   * Whether widget stores built against this core run their reactions and
   * timers. False on a preview, whose stores are seeded by hand and must not
   * have what was seeded overwritten; true on the overlay and a remote screen.
   */
  readonly startsWidgetStores: boolean;
  pitServiceWidget: PitServiceWidgetStore;
  trackMapWidget: TrackMapWidgetStore;
  /**
   * Read-only here: the core is what every window builds, and only main writes
   * the settings. `MainRoot` and `PreviewCore` hold the full store.
   */
  liveWidgets: LiveWidgetsView;
  widgetDefaults: WidgetDefaultsStore;
  layouts: LayoutsStore;

  /** What every settings write marks itself in — see `SettingsMutationLog`. */
  settingsMutations: SettingsMutationLog;
  appSettings: AppSettingsStore;
  units: UnitsStore;
  widgetAutoHide: WidgetAutoHideStore;

  constructor(options?: RendererCoreOptions) {
    this.player = new PlayerStore();
    this.cars = new CarsStore();
    this.session = new SessionStore();
    this.environment = new EnvironmentStore();
    this.simPerf = new SimPerfStore();
    this.referenceLap = new ReferenceLapStore();
    this.chat = new ChatStore();
    this.backendComputed = new BackendComputedStore(this.session);
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
    this.incidentsWidget = new IncidentsWidgetStore(this);
    this.radar = new RadarWidgetStore(this);
    this.playerPosition = new PlayerPositionStore(this);
    this.startsWidgetStores = options?.startsWidgetStores ?? !options?.skipInit;
    this.sharedWidgetStores = new SharedWidgetStores(
      { flags: this.flags, radar: this.radar },
      this.startsWidgetStores
    );
    this.widgetInstances = new WidgetInstanceRegistry((instanceId) =>
      this.liveWidgets.hotkeysActOnWidget(instanceId)
    );
    this.pitServiceWidget = new PitServiceWidgetStore(this);
    // A preview store shows a sample track: turning that map must not write an
    // angle to disk under a track id the user never drove.
    this.trackMapWidget = new TrackMapWidgetStore({
      persists: !options?.skipInit,
    });
    this.sim = new SimStore(this);
    this.widgetAutoHide = new WidgetAutoHideStore(this);

    if (!options?.skipInit) {
      this.sim.init();
      this.appSettings.init();
      this.pitServiceWidget.init();
      void this.chat.init();
    }
  }

  // Short-lived stores (widget previews, layout canvas, Storybook) must call
  // this on unmount — their reactions otherwise keep running against telemetry.
  dispose() {
    this.pitServiceWidget.dispose();
    this.chat.dispose();
    this.widgetInstances.disposeAll();
    this.flags.dispose();
    this.sim.dispose();
    this.radar.dispose();
  }
}

/**
 * A core a preview draws against — the layout editor's canvas, a widget
 * preview, a story. It writes freely into its own stores, since nothing it
 * holds is saved or sent anywhere: built with `skipInit`, it persists nothing.
 */
export class PreviewCore extends RendererCore {
  declare liveWidgets: LiveWidgetsStore;

  constructor() {
    super({ skipInit: true });
  }
}
