import type { TelemetrySnapshot } from '@/types/telemetry-snapshot';
import type { DriverEntriesFrame, RelativeFrame } from '@/types/bindings';
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
});
