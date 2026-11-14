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
 * The layout of the most specific rule that matches the situation; of equally
 * specific ones, the rule higher in the list. `null` when none matches.
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
