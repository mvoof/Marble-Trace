import { describe, expect, it } from 'vitest';
import {
  bool,
  choice,
  color,
  defineSettings,
  fileName,
  isValidDefault,
  nullable,
  num,
  normalizeOrder,
  numRecord,
  order,
  type SettingsOf,
} from './widget-settings-dsl';

const SCHEMA = defineSettings('example', {
  showPower: bool(true),
  width: num(200, { min: 100, max: 320 }),
  style: choice(['badge', 'plain'], 'badge'),
  scale: choice([2, 3, 4], 3),
  tint: color('#f5c518'),
  limit: nullable(num(80, { min: 20, max: 200 })),
  override: nullable(num(0, { min: 0, max: 200 }), null),
  widths: numRecord(),
});

type ExampleSettings = SettingsOf<typeof SCHEMA.shape>;

describe('defineSettings', () => {
  it('collects the shipped values', () => {
    const expected: ExampleSettings = {
      showPower: true,
      width: 200,
      style: 'badge',
      scale: 3,
      tint: '#f5c518',
      limit: 80,
      override: null,
      widths: {},
    };

    expect(SCHEMA.defaults).toEqual(expected);
  });

  it('lists the members of every choice', () => {
    expect(SCHEMA.selectOptions).toEqual({
      style: ['badge', 'plain'],
      scale: [2, 3, 4],
    });
  });

  it('keeps a valid override and leaves out keys it does not know', () => {
    const parsed = SCHEMA.parseOverrides({
      showPower: false,
      style: 'plain',
      scale: 4,
      tint: 'rgba(1, 2, 3, 0.5)',
      limit: null,
      widths: { flag: 120 },
      gone: 1,
    });

    expect(parsed.overrides).toEqual({
      showPower: false,
      style: 'plain',
      scale: 4,
      tint: 'rgba(1, 2, 3, 0.5)',
      limit: null,
      widths: { flag: 120 },
    });
    expect(parsed.rejected).toEqual([]);
  });

  it('rejects a wrong type or a value that is no longer a member', () => {
    const parsed = SCHEMA.parseOverrides({
      showPower: 'yes',
      style: 'neon',
      scale: '3',
      tint: 'red',
      width: null,
      widths: { flag: 'wide' },
    });

    expect(parsed.overrides).toEqual({});
    expect(parsed.rejected).toEqual([
      'showPower',
      'width',
      'style',
      'scale',
      'tint',
      'widths',
    ]);
  });

  it('keeps a bare file name and refuses anything a path could be built from', () => {
    const files = defineSettings('example', {
      image: nullable(fileName(''), null),
    });

    expect(
      files.parseOverrides({ image: 'wheel-3f2a.webp' }).overrides
    ).toEqual({ image: 'wheel-3f2a.webp' });

    ['../settings.json', '..', 'a/b.webp', 'a\\b.webp', '.hidden', ''].forEach(
      (image) => {
        expect(files.parseOverrides({ image }).rejected).toEqual(['image']);
      }
    );
  });

  it('clamps a number into its bounds', () => {
    expect(SCHEMA.parseOverrides({ width: 999 }).overrides).toEqual({
      width: 320,
    });
    expect(SCHEMA.parseOverrides({ width: -5 }).overrides).toEqual({
      width: 100,
    });
  });
});

describe('isValidDefault', () => {
  it('accepts every shipped value above', () => {
    Object.values(SCHEMA.shape).forEach((field) => {
      expect(isValidDefault(field)).toBe(true);
    });
  });

  it('refuses a default outside its own bounds', () => {
    expect(isValidDefault(num(5, { min: 10, max: 20 }))).toBe(false);
  });
});

describe('order', () => {
  const COLUMNS = ['pos', 'name', 'gap', 'tire'] as const;
  const ORDERED = defineSettings('example', { columnOrder: order(COLUMNS) });

  it('ships the members in their listed order', () => {
    expect(ORDERED.defaults.columnOrder).toEqual([
      'pos',
      'name',
      'gap',
      'tire',
    ]);
  });

  it('keeps a stored reorder', () => {
    const parsed = ORDERED.parseOverrides({
      columnOrder: ['gap', 'pos', 'tire', 'name'],
    });

    expect(parsed.overrides.columnOrder).toEqual([
      'gap',
      'pos',
      'tire',
      'name',
    ]);
    expect(parsed.rejected).toEqual([]);
  });

  it('rejects a value that is not a list of names', () => {
    expect(ORDERED.parseOverrides({ columnOrder: 'gap' }).rejected).toEqual([
      'columnOrder',
    ]);
    expect(ORDERED.parseOverrides({ columnOrder: [1, 2] }).rejected).toEqual([
      'columnOrder',
    ]);
  });

  it('drops names it no longer knows and repeats', () => {
    expect(
      normalizeOrder(['gap', 'gone', 'pos', 'gap', 'name', 'tire'], COLUMNS)
    ).toEqual(['gap', 'pos', 'name', 'tire']);
  });

  it('puts a member the stored list lacks after its shipped neighbour', () => {
    expect(normalizeOrder(['tire', 'pos', 'gap'], COLUMNS)).toEqual([
      'tire',
      'pos',
      'name',
      'gap',
    ]);
  });

  it('puts a missing first member first', () => {
    expect(normalizeOrder(['gap', 'name', 'tire'], COLUMNS)).toEqual([
      'pos',
      'gap',
      'name',
      'tire',
    ]);
  });

  it('accepts its own shipped value', () => {
    expect(isValidDefault(order(COLUMNS))).toBe(true);
  });
});
