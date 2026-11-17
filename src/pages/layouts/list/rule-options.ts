import type {
  CatalogueCar,
  KnownCar,
} from '@shared/contracts/generated/bindings';
import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

export interface RuleOptionsInput {
  catalogue: readonly CatalogueCar[];
  /** The live field's cars, then the recorded ones: the first entry wins. */
  liveCars: readonly KnownCar[];
  /** The rule being edited. */
  rule: AutoSwitchRule;
  rules: readonly AutoSwitchRule[];
}

/** A car a rule can name. */
export interface RuleCar {
  carId: number;
  name: string | null;
  badge: string | null;
}

/** The cars of one badge; `null` holds the cars nothing badges. */
export interface RuleCarGroup {
  badge: string | null;
  cars: RuleCar[];
}

export interface RuleOptions {
  classes: string[];
  carGroups: RuleCarGroup[];
}

const byText = (left: string, right: string): number =>
  left.localeCompare(right);

const groupByBadge = (cars: readonly RuleCar[]): RuleCarGroup[] => {
  const groups = new Map<string | null, RuleCar[]>();

  for (const car of cars) {
    groups.set(car.badge, [...(groups.get(car.badge) ?? []), car]);
  }

  return [...groups.entries()]
    .map(([badge, members]) => ({
      badge,
      cars: members.sort((left, right) =>
        byText(left.name ?? '', right.name ?? '')
      ),
    }))
    .sort((left, right) => {
      if (left.badge === null || right.badge === null) {
        return left.badge === null ? 1 : -1;
      }

      return byText(left.badge, right.badge);
    });
};

/**
 * The catalogue's cars with the live ones over them: a car the catalogue lacks
 * still comes from the live field, and for a car both know the live entry's
 * name and class win — its class is the one a rule is matched against. A car
 * the catalogue calls retired stays out even when a record still names it,
 * unless the rule being edited names it.
 */
const mergeCars = (
  catalogue: readonly CatalogueCar[],
  liveCars: readonly KnownCar[],
  namedCarId: number | null
): RuleCar[] => {
  const hiddenIds = new Set(
    catalogue
      .filter((car) => car.retired && car.carId !== namedCarId)
      .map((car) => car.carId)
  );
  const byId = new Map<number, RuleCar>();

  // Reversed, so the first live entry is written last and wins.
  for (const car of [...liveCars].reverse()) {
    byId.set(car.carId, {
      carId: car.carId,
      name: car.carName,
      badge: car.carClass,
    });
  }

  for (const car of catalogue) {
    const live = byId.get(car.carId);

    byId.set(car.carId, {
      carId: car.carId,
      name: live?.name ?? car.name,
      badge: live?.badge ?? car.badge,
    });
  }

  return [...byId.values()].filter((car) => !hiddenIds.has(car.carId));
};

/**
 * What the class and car lists of a rule offer: every car still raced, grouped
 * by its badge, and every badge among them. The class and the car narrow each
 * other, so a rule cannot name a car of another class.
 */
export const ruleOptions = ({
  catalogue,
  liveCars,
  rule,
}: RuleOptionsInput): RuleOptions => {
  const cars = mergeCars(catalogue, liveCars, rule.carId);
  const chosenCar = cars.find((car) => car.carId === rule.carId);
  // The rule's own class stays listed, though no car carries it any more.
  const classes = new Set(
    [...cars.map((car) => car.badge), rule.carClass].filter(
      (badge): badge is string => badge !== null
    )
  );
  const chosenBadge = chosenCar?.badge ?? null;
  const offeredClasses =
    chosenBadge === null ? [...classes].sort(byText) : [chosenBadge];
  const offeredCars = cars.filter(
    (car) =>
      rule.carClass === null ||
      car.badge === rule.carClass ||
      car.carId === rule.carId
  );

  return {
    classes: offeredClasses,
    carGroups: groupByBadge(offeredCars),
  };
};

/**
 * A rule's car by name — the live field's or the records' first, then the
 * catalogue's, retired cars included; `null` for a car no list knows.
 */
export const ruleCarName = (
  catalogue: readonly CatalogueCar[],
  liveCars: readonly KnownCar[],
  carId: number
): string | null =>
  liveCars.find((car) => car.carId === carId)?.carName ??
  catalogue.find((car) => car.carId === carId)?.name ??
  null;
