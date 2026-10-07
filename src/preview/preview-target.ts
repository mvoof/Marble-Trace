import type { BackendComputedStore } from '@store/data/computed.store';
import type { CarsStore } from '@store/data/cars.store';
import type { EnvironmentStore } from '@store/data/environment.store';
import type { FlagsStore } from '@store/widgets/flags/flags.store';
import type { PitServiceWidgetStore } from '@store/widgets/pit-service/pit-service.store';
import type { PlayerStore } from '@store/data/player.store';
import type { RadarWidgetStore } from '@store/widgets/radar/radar.store';
import type { ReferenceLapStore } from '@store/data/reference-lap.store';
import type { SessionStore } from '@store/data/session.store';
import type { SimStore } from '@store/sim/sim.store';
import type { TrackMapWidgetStore } from '@store/widgets/track-map/track-map.store';

/**
 * The stores a preview scenario writes into. A preview core holds them all;
 * naming them here keeps the scenarios off the core's own type.
 */
export interface PreviewTarget {
  backendComputed: BackendComputedStore;
  cars: CarsStore;
  environment: EnvironmentStore;
  flags: FlagsStore;
  pitServiceWidget: PitServiceWidgetStore;
  player: PlayerStore;
  radar: RadarWidgetStore;
  referenceLap: ReferenceLapStore;
  session: SessionStore;
  sim: SimStore;
  trackMapWidget: TrackMapWidgetStore;
}
