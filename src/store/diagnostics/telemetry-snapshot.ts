import type { RootStore } from '@store/root-store';
import type { TelemetrySnapshot } from '@/types/telemetry-snapshot';

/**
 * A frozen copy of the telemetry the widgets are reading right now, used as
 * test-data fixtures and as an attachment when a user reports something the
 * numbers should explain.
 */
export const captureSnapshot = (store: RootStore): TelemetrySnapshot => ({
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
