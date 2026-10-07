import { describe, it, expect } from 'vitest';
import { getContrastTextColor } from './colors';

describe('getContrastTextColor', () => {
  it('returns light text for transparent and plateless backgrounds', () => {
    expect(getContrastTextColor('transparent')).toBe('#ffffff');
    expect(getContrastTextColor('')).toBe('#ffffff');
    expect(getContrastTextColor('rgba(0, 0, 0, 0)')).toBe('#ffffff');
    expect(getContrastTextColor('rgba(255, 255, 255, 0.1)')).toBe('#ffffff');
  });

  it('returns light text for dark backgrounds', () => {
    expect(getContrastTextColor('rgba(21, 22, 26, 0.8)')).toBe('#ffffff');
    expect(getContrastTextColor('#000000')).toBe('#ffffff');
    expect(getContrastTextColor('#15161a')).toBe('#ffffff');
    expect(getContrastTextColor('rgb(20, 20, 20)')).toBe('#ffffff');
  });

  it('returns dark text for bright and light backgrounds', () => {
    expect(getContrastTextColor('#ffffff')).toBe('#111111');
    expect(getContrastTextColor('#facc15')).toBe('#111111');
    expect(getContrastTextColor('rgb(240, 240, 240)')).toBe('#111111');
    expect(getContrastTextColor('rgba(255, 255, 255, 0.9)')).toBe('#111111');
  });
});
