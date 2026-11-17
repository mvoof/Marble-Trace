import { describe, expect, it } from 'vitest';

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

const rule = (patch: Partial<AutoSwitchRule> = {}): AutoSwitchRule => ({
  id: 'rule',
  context: null,
  carClass: null,
  carId: null,
  layoutId: 'layout',
  ...patch,
});

const CATALOGUE = [
  catalogueCar(173, 'Ferrari 296 GT3', 'GT3'),
  catalogueCar(156, 'Mercedes-AMG GT3 2020', 'GT3'),
  catalogueCar(150, 'Aston Martin Vantage GT4', 'GT4'),
  catalogueCar(67, 'Global Mazda MX-5 Cup', 'MX-5'),
];

const carIdsOf = (options: ReturnType<typeof ruleOptions>): number[][] =>
  options.carGroups.map((group) => group.cars.map((car) => car.carId));

describe('ruleOptions', () => {
  it('offers every badge of the catalogue as a class, once each', () => {
    const editing = rule();
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      rule: editing,
      rules: [editing],
    });

    expect(options.classes).toEqual(['GT3', 'GT4', 'MX-5']);
  });

  it('groups the cars by badge, by name, and leaves retired cars out', () => {
    const editing = rule();
    const options = ruleOptions({
      catalogue: [...CATALOGUE, catalogueCar(1, 'Skip Barber', 'SBRS', true)],
      liveCars: [],
      rule: editing,
      rules: [editing],
    });

    expect(options.carGroups.map((group) => group.badge)).toEqual([
      'GT3',
      'GT4',
      'MX-5',
    ]);
    expect(carIdsOf(options)).toEqual([[173, 156], [150], [67]]);
    expect(options.classes).not.toContain('SBRS');
  });

  it('narrows the cars to the chosen class', () => {
    const editing = rule({ carClass: 'GT3' });
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      rule: editing,
      rules: [editing],
    });

    expect(carIdsOf(options)).toEqual([[173, 156]]);
  });

  it("narrows the classes to the chosen car's badge", () => {
    const editing = rule({ carId: 150 });
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      rule: editing,
      rules: [editing],
    });

    expect(options.classes).toEqual(['GT4']);
  });

  it("keeps the rule's own class listed though no car carries it", () => {
    const editing = rule({ carClass: 'GT3 Class' });
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [],
      rule: editing,
      rules: [editing],
    });

    expect(options.classes).toEqual(['GT3', 'GT3 Class', 'GT4', 'MX-5']);
  });

  it('keeps a retired car the rule already names, by its name', () => {
    const editing = rule({ carId: 1 });
    const options = ruleOptions({
      catalogue: [...CATALOGUE, catalogueCar(1, 'Skip Barber', 'SBRS', true)],
      liveCars: [],
      rule: editing,
      rules: [editing],
    });

    expect(options.carGroups.at(-1)).toEqual({
      badge: 'SBRS',
      cars: [{ carId: 1, name: 'Skip Barber', badge: 'SBRS' }],
    });
    expect(options.classes).toEqual(['SBRS']);
  });

  it('adds a car only the live field knows, under its class', () => {
    const editing = rule();
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [
        liveCar(999, 'Brand New GT3', 'GT3'),
        liveCar(998, 'Kart', null),
      ],
      rule: editing,
      rules: [editing],
    });

    expect(carIdsOf(options)).toEqual([[999, 173, 156], [150], [67], [998]]);
    expect(options.carGroups.at(-1)?.badge).toBeNull();
  });

  it('lets the first live entry win for a car the catalogue knows too', () => {
    const editing = rule();
    const options = ruleOptions({
      catalogue: CATALOGUE,
      liveCars: [
        liveCar(67, 'Mazda MX-5 Cup', 'MX5 Cup'),
        liveCar(67, 'Mazda MX-5 (recorded)', 'MX-5 Class'),
      ],
      rule: editing,
      rules: [editing],
    });

    expect(options.classes).toEqual(['GT3', 'GT4', 'MX5 Cup']);
    expect(options.carGroups.at(-1)).toEqual({
      badge: 'MX5 Cup',
      cars: [{ carId: 67, name: 'Mazda MX-5 Cup', badge: 'MX5 Cup' }],
    });
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
