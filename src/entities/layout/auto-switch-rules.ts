import type {
  CatalogueCar,
  KnownCar,
  SessionType,
} from '@shared/contracts/generated/bindings';
import type {
  AutoSwitchRule,
  SessionContext,
} from '@shared/contracts/widget-settings';

/** Where the driver is and in what: what an auto-switch rule is matched to. */
export interface AutoSwitchSituation {
  context: SessionContext;
  /** `null` while the car is not known: no class or car rule matches then. */
  carClass: string | null;
  carId: number | null;
}

/** What a rule names: each of the three `null` for "any". */
export type RuleSituation = Pick<
  AutoSwitchRule,
  'context' | 'carClass' | 'carId'
>;

// A named car outweighs a named class and a session together, and a class
// outweighs a session: the user's order (2026-11-14), car > class > session.
const CAR_WEIGHT = 4;
const CLASS_WEIGHT = 2;
const CONTEXT_WEIGHT = 1;

const NO_MATCH = -1;

/** How specific the rule is for the situation, or `NO_MATCH`. */
const specificity = (
  rule: AutoSwitchRule,
  situation: AutoSwitchSituation
): number => {
  const contextMatches =
    rule.context === null || rule.context === situation.context;
  const classMatches =
    rule.carClass === null || rule.carClass === situation.carClass;
  const carMatches = rule.carId === null || rule.carId === situation.carId;

  if (!contextMatches || !classMatches || !carMatches) {
    return NO_MATCH;
  }

  return (
    (rule.carId === null ? 0 : CAR_WEIGHT) +
    (rule.carClass === null ? 0 : CLASS_WEIGHT) +
    (rule.context === null ? 0 : CONTEXT_WEIGHT)
  );
};

/**
 * The layout of the most specific rule that matches the situation, `null` when
 * none matches. No two rules name the same situation, so two that match always
 * differ in specificity: the order of the list never decides.
 */
export const ruleLayoutFor = (
  rules: readonly AutoSwitchRule[],
  situation: AutoSwitchSituation
): string | null => {
  let best: AutoSwitchRule | null = null;
  let bestSpecificity = NO_MATCH;

  for (const rule of rules) {
    const ruleSpecificity = specificity(rule, situation);

    if (ruleSpecificity > bestSpecificity) {
      best = rule;
      bestSpecificity = ruleSpecificity;
    }
  }

  return best?.layoutId ?? null;
};

/** What the sim says about the driver: what the auto-switch target is read from. */
export interface AutoSwitchSimState {
  isConnected: boolean;
  isOnTrack: boolean;
  sessionType: SessionType | null;
  catalogue: readonly CatalogueCar[];
  playerCar: KnownCar | null;
}

/** The situation the driver is in, and the layout it puts on screen. */
export interface AutoSwitchTarget {
  /** `null` in a session of a kind no rule names. */
  situation: AutoSwitchSituation | null;
  /** `null` when no rule matches the situation: the screen stays as it is. */
  layoutId: string | null;
}

const SESSION_CONTEXT_BY_TYPE: Partial<Record<SessionType, SessionContext>> = {
  Practice: 'Practice',
  Qualify: 'Qualify',
  Race: 'Race',
};

const sessionContextOf = (
  isOnTrack: boolean,
  sessionType: SessionType | null
): SessionContext | null => {
  if (!isOnTrack) {
    return 'Garage';
  }

  return sessionType === null
    ? null
    : (SESSION_CONTEXT_BY_TYPE[sessionType] ?? null);
};

/**
 * Where the driver is and the layout auto-switch puts on screen for it — the
 * one answer both the switch and the main window's "Now" line read. `null`
 * while the sim is not connected.
 */
export const autoSwitchTarget = (
  rules: readonly AutoSwitchRule[],
  sim: AutoSwitchSimState
): AutoSwitchTarget | null => {
  if (!sim.isConnected) {
    return null;
  }

  const context = sessionContextOf(sim.isOnTrack, sim.sessionType);

  if (context === null) {
    return { situation: null, layoutId: null };
  }

  const situation: AutoSwitchSituation = {
    context,
    carClass: playerCarClass(sim.catalogue, sim.playerCar),
    carId: sim.playerCar?.carId ?? null,
  };

  return { situation, layoutId: ruleLayoutFor(rules, situation) };
};

/** The layout of the rule naming exactly this situation, or `null`. */
export const layoutHolding = (
  rules: readonly AutoSwitchRule[],
  situation: RuleSituation
): string | null =>
  rules.find(
    (rule) =>
      rule.context === situation.context &&
      rule.carClass === situation.carClass &&
      rule.carId === situation.carId
  )?.layoutId ?? null;

/**
 * The class a class rule is matched against: the catalogue's badge of the
 * player's own car — a GT3 car is GT3 in a hosted "All Cars" class too. A car
 * the catalogue lacks keeps the session class's badge.
 */
export const playerCarClass = (
  catalogue: readonly CatalogueCar[],
  playerCar: KnownCar | null
): string | null => {
  if (!playerCar) {
    return null;
  }

  return (
    catalogue.find((car) => car.carId === playerCar.carId)?.badge ??
    playerCar.carClass
  );
};

/**
 * The rule with the change applied, naming a class or a car, never both: the
 * one the change names wins, and of a rule naming both already, the car.
 */
export const withRuleChange = <Rule extends RuleSituation>(
  rule: Rule,
  change: Partial<Rule>
): Rule => {
  const next = { ...rule, ...change };

  if (change.carClass != null && change.carId == null) {
    next.carId = null;
  } else if (next.carId !== null) {
    next.carClass = null;
  }

  return next;
};
