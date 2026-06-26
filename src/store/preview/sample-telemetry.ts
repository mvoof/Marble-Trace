import type { TelemetrySnapshot } from '@/types/telemetry-snapshot';
import type {
  DriverEntriesFrame,
  ProximityFrame,
  RelativeFrame,
} from '@/types/bindings';
import { action } from 'mobx';
import type { RootStore } from '@store/root-store';
import { computeDriverEntries } from './compute-driver-entries';

// Neutral sample-telemetry fixture shared by any consumer that needs to render
// widgets against representative data (in-app widget preview, Storybook, …).
// It depends on neither the app UI nor Storybook — consumers depend on it.
const snapshotModules = import.meta.glob('../../../test-data/iracing-*.json', {
  eager: true,
  import: 'default',
});

const firstSnapshot = Object.values(snapshotModules)[0];

if (!firstSnapshot) {
  throw new Error('No iracing-*.json snapshot found in test-data/');
}

export const sampleSnapshot = firstSnapshot as unknown as TelemetrySnapshot;

// Wrapped in `action` so the whole batch of setters runs as a single MobX
// transaction — callers (preview, layout editor, Storybook) invoke it directly
// without needing their own `runInAction`.
export const seedSampleTelemetry = action((store: RootStore) => {
  // Mark connected so widgets that gate rendering on a live session show their
  // sample data instead of a "no data" placeholder.
  store.sim.isConnected = true;
  store.sim.status = 'connected';

  if (sampleSnapshot.carDynamics)
    store.player.updateCarDynamics(sampleSnapshot.carDynamics);
  if (sampleSnapshot.carIdx) store.cars.updateCarIdx(sampleSnapshot.carIdx);
  if (sampleSnapshot.carInputs)
    store.player.updateCarInputs(sampleSnapshot.carInputs);
  if (sampleSnapshot.carStatus)
    store.player.updateCarStatus(sampleSnapshot.carStatus);
  if (sampleSnapshot.environment)
    store.environment.updateEnvironment(sampleSnapshot.environment);
  if (sampleSnapshot.lapTiming)
    store.player.updateLapTiming(sampleSnapshot.lapTiming);
  if (sampleSnapshot.session)
    store.session.updateSession(sampleSnapshot.session);
  if (sampleSnapshot.sessionInfo)
    store.session.updateSessionInfo(sampleSnapshot.sessionInfo);

  const entries = computeDriverEntries(
    sampleSnapshot.carIdx ?? null,
    sampleSnapshot.sessionInfo ?? null
  );

  if (entries.length > 0) {
    const playerCarIdx = sampleSnapshot.sessionInfo?.playerCarIdx ?? 0;

    store.backendComputed.updateStandings({
      entries,
      playerCarIdx,
    } as DriverEntriesFrame);

    store.backendComputed.updateRelative({
      entries,
      playerCarIdx,
    } as RelativeFrame);
  }

  // Seed a light proximity frame and force the radar visible so radar widgets
  // render in the preview/editor. The auto-hide reaction that normally gates
  // visibility never runs in the isolated preview store (skipInit), so without
  // this the radar would always be blank. Richer traffic is layered by the
  // radar-traffic scenario.
  const baselineProximity: ProximityFrame = {
    nearbyCars: [
      {
        carIdx: 7,
        longitudinalDist: 3.2,
        lateralSide: 'center',
        clearance: 3.2,
      },
      {
        carIdx: 12,
        longitudinalDist: -4.1,
        lateralSide: 'center',
        clearance: 4.1,
      },
      { carIdx: 3, longitudinalDist: 1.4, lateralSide: 'left', clearance: 1.4 },
      {
        carIdx: 19,
        longitudinalDist: 1.9,
        lateralSide: 'right',
        clearance: 1.9,
      },
    ],
    // Side distances + spotter contact so the Radar Bar (side indicators) and
    // the proximity radar's side cones both render in the preview.
    radarDistances: {
      frontDist: 3.2,
      rearDist: 4.1,
      leftDist: 1.4,
      rightDist: 1.9,
    },
    spotterLeft: true,
    spotterRight: true,
  };

  store.backendComputed.updateProximity(baselineProximity);
  store.radar.visible = true;
});
