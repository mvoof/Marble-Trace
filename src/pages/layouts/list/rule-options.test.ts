import { describe, expect, it } from 'vitest';

import type { RuleSituation } from '@entities/layout/auto-switch-rules';
import type {
  CatalogueCar,
  KnownCar,
} from '@shared/contracts/generated/bindings';
import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

import { ruleCarName, ruleOptions } from './rule-options';

const catalogueCar = (
  carId: number,
  name: string,
  badge: string,
  retired = false
): CatalogueCar => ({ carId, name, badge, retired });

const liveCar = (
  carId: number,
  carName: string | null,
  carClass: string | null
): KnownCar => ({ carId, carName, carClass });

const draft = (patch: Partial<RuleSituation> = {}): RuleSituation => ({
  context: null,
  carClass: null,
  carId: null,
  ...patch,
});

const heldRule = (
  layoutId: string,
  patch: Partial<RuleSituation>
): AutoSwitchRule => ({
  id: `${layoutId}-rule`,
  layoutId,
  ...draft(patch),
});

const CATALOGUE = [
  catalogueCar(173, 'Ferrari 296 GT3', 'GT3'),
  catalogueCar(156, 'Mercedes-AMG GT3 2020', 'GT3'),
  catalogueCar(150, 'Aston Martin Vantage GT4', 'GT4'),
  catalogueCar(67, 'Global Mazda MX-5 Cup', 'MX-5'),
];

type Options = ReturnType<typeof ruleOptions>;

const carIdsOf = (options: Options): number[][] =>
  options.carGroups.map((group) => group.cars.map((car) => car.carId));

const badgesOf = (options: Options): string[] =>
  options.classes.map((option) => option.badge);

describe('ruleOptions', () => {
  it('offers every badge of the catalogue as a class, once each', () => {
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      draft: draft(),
      rules: [],
    });

    expect(badgesOf(options)).toEqual(['GT3', 'GT4', 'MX-5']);
  });

  it('groups the cars by badge, by name, and leaves retired cars out', () => {
    const options = ruleOptions({
      catalogue: [...CATALOGUE, catalogueCar(1, 'Skip Barber', 'SBRS', true)],
      liveCars: [],
      draft: draft(),
      rules: [],
    });

    expect(options.carGroups.map((group) => group.badge)).toEqual([
      'GT3',
      'GT4',
      'MX-5',
    ]);
    expect(carIdsOf(options)).toEqual([[173, 156], [150], [67]]);
    expect(badgesOf(options)).not.toContain('SBRS');
  });

  it('narrows the cars to the chosen class', () => {
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      draft: draft({ carClass: 'GT3' }),
      rules: [],
    });

    expect(carIdsOf(options)).toEqual([[173, 156]]);
  });

  it("narrows the classes to the chosen car's badge", () => {
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      draft: draft({ carId: 150 }),
      rules: [],
    });

    expect(badgesOf(options)).toEqual(['GT4']);
    expect(options.carBadge).toBe('GT4');
  });

  it('keeps a retired car the draft already names, by its name', () => {
    const options = ruleOptions({
      catalogue: [...CATALOGUE, catalogueCar(1, 'Skip Barber', 'SBRS', true)],
      liveCars: [],
      draft: draft({ carId: 1 }),
      rules: [],
    });

    expect(options.carGroups.at(-1)).toEqual({
      badge: 'SBRS',
      cars: [{ carId: 1, name: 'Skip Barber', badge: 'SBRS', heldBy: null }],
    });
    expect(badgesOf(options)).toEqual(['SBRS']);
  });

  it('adds a car only the live field knows, under its class', () => {
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [
        liveCar(999, 'Brand New GT3', 'GT3'),
        liveCar(998, 'Kart', null),
      ],
      draft: draft(),
      rules: [],
    });

    expect(carIdsOf(options)).toEqual([[999, 173, 156], [150], [67], [998]]);
    expect(options.carGroups.at(-1)?.badge).toBeNull();
  });

  it('lets the first live entry win for a car the catalogue knows too', () => {
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [
        liveCar(67, 'Mazda MX-5 Cup', 'MX5 Cup'),
        liveCar(67, 'Mazda MX-5 (recorded)', 'MX-5 Class'),
      ],
      draft: draft(),
      rules: [],
    });

    expect(badgesOf(options)).toEqual(['GT3', 'GT4', 'MX5 Cup']);
    expect(options.carGroups.at(-1)).toEqual({
      badge: 'MX5 Cup',
      cars: [
        { carId: 67, name: 'Mazda MX-5 Cup', badge: 'MX5 Cup', heldBy: null },
      ],
    });
  });

  it('marks a class and a car held in the chosen session by their layout', () => {
    const rules = [
      heldRule('race-gt3', { context: 'Race', carClass: 'GT3' }),
      heldRule('race-amg', { context: 'Race', carId: 156 }),
      heldRule('any-gt4', { carClass: 'GT4' }),
    ];
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      draft: draft({ context: 'Race' }),
      rules,
    });

    expect(options.classes).toEqual([
      { badge: 'GT3', heldBy: 'race-gt3' },
      { badge: 'GT4', heldBy: null },
      { badge: 'MX-5', heldBy: null },
    ]);
    expect(
      options.carGroups[0]?.cars.map((car) => [car.carId, car.heldBy])
    ).toEqual([
      [173, null],
      [156, 'race-amg'],
    ]);
  });

  it('names the layout holding the whole draft, or none', () => {
    const rules = [heldRule('race-gt3', { context: 'Race', carClass: 'GT3' })];
    const optionsFor = (situation: RuleSituation) =>
      ruleOptions({
        catalogue: CATALOGUE,
        liveCars: [],
        draft: situation,
        rules,
      });

    expect(optionsFor(draft({ context: 'Race', carClass: 'GT3' })).heldBy).toBe(
      'race-gt3'
    );
    expect(optionsFor(draft({ carClass: 'GT3' })).heldBy).toBeNull();
  });
});

describe('ruleCarName', () => {
  it('names a car from the live field first, then the catalogue', () => {
    const catalogue = [catalogueCar(1, 'Skip Barber', 'SBRS', true)];
    const liveCars = [liveCar(67, 'Mazda MX-5 Cup', 'MX-5')];

    expect(ruleCarName(catalogue, liveCars, 67)).toBe('Mazda MX-5 Cup');
    expect(ruleCarName(catalogue, liveCars, 1)).toBe('Skip Barber');
    expect(ruleCarName(catalogue, liveCars, 404)).toBeNull();
  });
});
