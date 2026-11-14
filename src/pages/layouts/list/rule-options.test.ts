import { describe, expect, it } from 'vitest';

import type { KnownCar } from '@shared/contracts/generated/bindings';

import { ruleCars, ruleClasses } from './rule-options';

const car = (
  carId: number,
  carName: string,
  carClass: string | null
): KnownCar => ({ carId, carName, carClass });

describe('ruleCars', () => {
  it('lists each car once, the live field winning, by name', () => {
    const field = [car(156, 'Mercedes-AMG GT3 2020', 'GT3')];
    const recorded = [
      car(156, 'Mercedes-AMG GT3 2020', 'GT3 Class'),
      car(143, 'Porsche 911 GT3 Cup', 'PCup'),
    ];

    expect(ruleCars(field, recorded)).toEqual([
      car(156, 'Mercedes-AMG GT3 2020', 'GT3'),
      car(143, 'Porsche 911 GT3 Cup', 'PCup'),
    ]);
  });
});

describe('ruleClasses', () => {
  it('lists the classes of the cars and of the rules, once each', () => {
    const cars = [car(156, 'Mercedes', 'GT3'), car(1, 'Skippy', null)];
    const rules = [
      {
        id: 'rule',
        context: null,
        carClass: 'GTP',
        carId: null,
        layoutId: 'layout',
      },
    ];

    expect(ruleClasses([...cars, car(9, 'Audi', 'GT3')], rules)).toEqual([
      'GT3',
      'GTP',
    ]);
  });
});
