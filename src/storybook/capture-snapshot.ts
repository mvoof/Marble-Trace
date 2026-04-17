import { telemetryStore } from '../store/iracing';
import type { TelemetrySnapshot } from './snapshot.types';

export const captureSnapshot = (): TelemetrySnapshot => ({
  capturedAt: new Date().toISOString(),
  carDynamics: telemetryStore.carDynamics,
  carIdx: telemetryStore.carIdx,
  carInputs: telemetryStore.carInputs,
  carStatus: telemetryStore.carStatus,
  environment: telemetryStore.environment,
  lapTiming: telemetryStore.lapTiming,
  session: telemetryStore.session,
  sessionInfo: telemetryStore.sessionInfo,
});

export const downloadSnapshot = (name = 'snapshot') => {
  const snapshot = captureSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
