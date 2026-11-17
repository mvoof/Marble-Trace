import { useSessionStore } from '@entities/session/session-context';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import type { KnownCar } from '@shared/contracts/generated/bindings';

/** The live field's cars, then the recorded ones: the first entry wins. */
export const useLiveCars = (): KnownCar[] => {
  const session = useSessionStore();
  const statistics = useStatisticsStore();

  return [...session.fieldCars, ...statistics.knownCars];
};
