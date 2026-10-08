import type { BackendComputedStore } from '@entities/cars/computed.store';
import type { CarsStore } from '@entities/cars/cars.store';
import type { EnvironmentStore } from '@entities/environment/environment.store';
import type { FlagsStore } from '@entities/flags/flags.store';
import type { PitServiceWidgetStore } from '@features/pit-service/pit-service.store';
import type { PlayerStore } from '@entities/player/player.store';
import type { RadarWidgetStore } from '@entities/radar/radar.store';
import type { ReferenceLapStore } from '@entities/player/reference-lap.store';
import type { SessionStore } from '@entities/session/session.store';
import type { SimStore } from '@entities/sim/sim.store';
import type { TrackMapWidgetStore } from '@entities/track/track-map.store';

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
