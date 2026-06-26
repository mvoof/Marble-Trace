import type { TelemetrySnapshot } from '@/types/telemetry-snapshot';
import type {
  DriverEntriesFrame,
  ProximityFrame,
  RelativeFrame,
} from '@/types/bindings';
import { action } from 'mobx';
import type { RootStore } from '@store/root-store';
import { computeDriverEntries } from './compute-driver-entries';
import { sampleTrack, SAMPLE_TRACK_ID } from './sample-track';

// Mirror the active race flags into the FlagsStore's display state. The hold /
// blink reactions that normally do this only run via FlagsStore.init(), which is
// skipped in the isolated preview store — so without this the flag widgets stay
// blank no matter what flag is active.
export const syncFlagDisplay = action((store: RootStore) => {
  store.flags.displayFlags = store.flags.parsedFlags;
  store.flags.ledDisplayFlag = store.flags.parsedFlag;
});

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
    // Baseline shows a green flag so the flag widgets are populated in the
    // preview regardless of their visibility settings (which should only affect
    // the live overlay). Flag scenarios override this.
    store.player.updateCarStatus({
      ...sampleSnapshot.carStatus,
      flags: { ...sampleSnapshot.carStatus.flags, green: true },
    });
  if (sampleSnapshot.environment)
    store.environment.updateEnvironment(sampleSnapshot.environment);
  if (sampleSnapshot.lapTiming)
    store.player.updateLapTiming(sampleSnapshot.lapTiming);
  if (sampleSnapshot.session)
    store.session.updateSession(sampleSnapshot.session);
  if (sampleSnapshot.sessionInfo)
    // Pin the session's track to the synthetic sample track so the track-map
    // widget keeps the seeded shape instead of clearing it and showing the
    // "recording" placeholder.
    store.session.updateSessionInfo({
      ...sampleSnapshot.sessionInfo,
      trackId: SAMPLE_TRACK_ID,
    });

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

  // Seed the synthetic track outline so the track-map widget renders a map
  // instead of the "recording track" placeholder.
  store.trackMapWidget.onTrackShapeReceived(sampleTrack);

  syncFlagDisplay(store);
});
