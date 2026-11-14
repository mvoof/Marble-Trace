import { describe, expect, it } from 'vitest';
import { DATA_MENU, DEFAULT_DATA_SECTION } from './data-sections';

describe('DATA_MENU', () => {
  it('lists recorded tracks, strategy and statistics, in that order', () => {
    expect(DATA_MENU).toEqual(['tracks', 'strategy', 'statistics']);
  });

  it('opens on recorded tracks', () => {
    expect(DEFAULT_DATA_SECTION).toBe('tracks');
  });
});
