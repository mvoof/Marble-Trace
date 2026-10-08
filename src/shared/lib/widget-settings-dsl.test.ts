import { describe, expect, it } from 'vitest';
import {
  bool,
  choice,
  color,
  defineSettings,
  isValidDefault,
  nullable,
  num,
  numRecord,
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
