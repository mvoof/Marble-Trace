import { describe, expect, it } from 'vitest';
import {
  DATA_MENU,
  DEFAULT_DATA_SECTION,
  dataSectionOf,
} from './data-sections';

describe('DATA_MENU', () => {
  it('lists recorded tracks, strategy and statistics, in that order', () => {
    expect(DATA_MENU).toEqual(['tracks', 'strategy', 'statistics']);
  });

  it('opens on recorded tracks', () => {
    expect(DEFAULT_DATA_SECTION).toBe('tracks');
  });
});

describe('dataSectionOf', () => {
  it('takes a section the menu has, else the first', () => {
    expect(dataSectionOf('strategy')).toBe('strategy');
    expect(dataSectionOf('nonsense')).toBe('tracks');
    expect(dataSectionOf(null)).toBe('tracks');
  });
});
