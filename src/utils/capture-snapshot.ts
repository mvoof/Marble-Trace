import type { RootStore } from '@store/root-store';
import type { TelemetrySnapshot } from '@/types/telemetry-snapshot';

const captureSnapshot = (store: RootStore): TelemetrySnapshot => ({
  capturedAt: new Date().toISOString(),
  carDynamics: store.player.carDynamics,
  carIdx: store.cars.carIdx,
  carInputs: store.player.carInputs,
  carStatus: store.player.carStatus,
  environment: store.environment.environment,
  lapTiming: store.player.lapTiming,
  session: store.session.session,
  sessionInfo: store.session.sessionInfo,
});

export const downloadSnapshot = (store: RootStore, name = 'snapshot') => {
  const snapshot = captureSnapshot(store);

  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${Date.now()}.json`;

  a.click();

  URL.revokeObjectURL(url);
};
