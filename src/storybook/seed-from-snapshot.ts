import { snapshot } from './test-data';
import type { RootStore } from '@store/root-store';

export const seedFromSnapshot = (store: RootStore) => {
  if (snapshot.carDynamics)
    store.telemetry.updateCarDynamics(snapshot.carDynamics);
  if (snapshot.carIdx) store.telemetry.updateCarIdx(snapshot.carIdx);
  if (snapshot.carInputs) store.telemetry.updateCarInputs(snapshot.carInputs);
  if (snapshot.carStatus) store.telemetry.updateCarStatus(snapshot.carStatus);
  if (snapshot.environment)
    store.telemetry.updateEnvironment(snapshot.environment);
  if (snapshot.lapTiming) store.telemetry.updateLapTiming(snapshot.lapTiming);
  if (snapshot.session) store.telemetry.updateSession(snapshot.session);
  if (snapshot.sessionInfo)
    store.telemetry.updateSessionInfo(snapshot.sessionInfo);
};
