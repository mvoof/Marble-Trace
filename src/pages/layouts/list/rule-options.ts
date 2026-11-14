import type { KnownCar } from '@shared/contracts/generated/bindings';
import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

/**
 * The cars a rule can name, by name: the live field's and the session
 * records', once each. Where both know a car, the live field's entry wins —
 * its class is the one a rule will be matched against.
 */
export const ruleCars = (
  fieldCars: readonly KnownCar[],
  recordedCars: readonly KnownCar[]
): KnownCar[] => {
  const byId = new Map<number, KnownCar>();

  for (const car of [...fieldCars, ...recordedCars]) {
    if (!byId.has(car.carId)) {
      byId.set(car.carId, car);
    }
  }

  return [...byId.values()].sort((left, right) =>
    (left.carName ?? '').localeCompare(right.carName ?? '')
  );
};

/** The car's name as the lists know it, or `null` for a car they do not. */
export const carNameOf = (
  cars: readonly KnownCar[],
  carId: number
): string | null => cars.find((car) => car.carId === carId)?.carName ?? null;

/** Every class of the cars and of the rules, so a rule's own class stays listed. */
export const ruleClasses = (
  cars: readonly KnownCar[],
  rules: readonly AutoSwitchRule[]
): string[] => {
  const classes = new Set<string>();

  for (const name of [
    ...cars.map((car) => car.carClass),
    ...rules.map((rule) => rule.carClass),
  ]) {
    if (name !== null) {
      classes.add(name);
    }
  }

  return [...classes].sort((left, right) => left.localeCompare(right));
};
