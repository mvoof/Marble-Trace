import { describe, expect, it } from 'vitest';

import { setupLabel } from './setup-label';

describe('setupLabel', () => {
  it('splits the sim’s key into words, acronyms kept whole', () => {
    expect(setupLabel('StartingPressure')).toBe('Starting Pressure');
    expect(setupLabel('LastTempsOMI')).toBe('Last Temps OMI');
    expect(setupLabel('ARBSetting')).toBe('ARB Setting');
    expect(setupLabel('Fuel')).toBe('Fuel');
  });

  it('keeps numbers with what they count', () => {
    expect(setupLabel('Gear1')).toBe('Gear 1');
    expect(setupLabel('TcSetting2Map')).toBe('Tc Setting 2 Map');
  });
});
