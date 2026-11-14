import { describe, expect, it } from 'vitest';

import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

import { ruleLayoutFor, type AutoSwitchSituation } from './auto-switch-rules';

const MERCEDES_GT3 = 156;
const PORSCHE_CUP = 143;

const rule = (
  layoutId: string,
  conditions: Partial<Omit<AutoSwitchRule, 'id' | 'layoutId'>> = {}
): AutoSwitchRule => ({
  id: layoutId,
  context: null,
  carClass: null,
  carId: null,
  layoutId,
  ...conditions,
});

const raceInMercedes: AutoSwitchSituation = {
  context: 'Race',
  carClass: 'GT3',
  carId: MERCEDES_GT3,
};

describe('ruleLayoutFor', () => {
  it('picks the rule of the session context', () => {
    const rules = [
      rule('practice', { context: 'Practice' }),
      rule('race', { context: 'Race' }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('race');
  });

  it('answers null when no rule matches', () => {
    const rules = [rule('practice', { context: 'Practice' })];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBeNull();
  });

  it('takes a class rule over a session rule', () => {
    const rules = [
      rule('race', { context: 'Race' }),
      rule('gt3', { carClass: 'GT3' }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('gt3');
  });

  it('takes a car rule over a class and session rule', () => {
    const rules = [
      rule('gt3-race', { context: 'Race', carClass: 'GT3' }),
      rule('mercedes', { carId: MERCEDES_GT3 }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('mercedes');
  });

  it('takes the car rule of the session over the car rule of any session', () => {
    const rules = [
      rule('mercedes', { carId: MERCEDES_GT3 }),
      rule('mercedes-race', { context: 'Race', carId: MERCEDES_GT3 }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('mercedes-race');
  });

  it('skips a rule naming another car or class', () => {
    const rules = [
      rule('porsche', { carId: PORSCHE_CUP }),
      rule('gtp', { carClass: 'GTP' }),
      rule('any'),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('any');
  });

  it('skips a car or class rule while the car is unknown', () => {
    const rules = [rule('mercedes', { carId: MERCEDES_GT3 }), rule('any')];

    expect(
      ruleLayoutFor(rules, { context: 'Garage', carClass: null, carId: null })
    ).toBe('any');
  });

  it('gives a tie to the rule higher in the list', () => {
    const rules = [
      rule('first', { carClass: 'GT3' }),
      rule('second', { carClass: 'GT3' }),
    ];

    expect(ruleLayoutFor(rules, raceInMercedes)).toBe('first');
  });
});
