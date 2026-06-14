import { snapshot } from './test-data';
import type { RootStore } from '@store/root-store';

export const seedFromSnapshot = (store: RootStore) => {
  if (snapshot.carDynamics)
    store.player.updateCarDynamics(snapshot.carDynamics);
  if (snapshot.carIdx) store.cars.updateCarIdx(snapshot.carIdx);
  if (snapshot.carInputs) store.player.updateCarInputs(snapshot.carInputs);
  if (snapshot.carStatus) store.player.updateCarStatus(snapshot.carStatus);
  if (snapshot.environment)
    store.environment.updateEnvironment(snapshot.environment);
  if (snapshot.lapTiming) store.player.updateLapTiming(snapshot.lapTiming);
  if (snapshot.session) store.session.updateSession(snapshot.session);
  if (snapshot.sessionInfo)
    store.session.updateSessionInfo(snapshot.sessionInfo);
};
