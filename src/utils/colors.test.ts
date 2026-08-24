import { describe, expect, it } from 'vitest';
import { withAlphaFactor } from './colors';

describe('withAlphaFactor', () => {
  it('keeps the color untouched at full opacity', () => {
    expect(withAlphaFactor('rgba(21, 22, 26, 0.8)', 1)).toBe(
      'rgba(21, 22, 26, 0.8)'
    );
  });

  it('scales an existing alpha channel', () => {
    expect(withAlphaFactor('rgba(21, 22, 26, 0.8)', 0.5)).toBe(
      'rgba(21, 22, 26, 0.400)'
    );
  });

  it('treats a color without alpha as fully opaque', () => {
    expect(withAlphaFactor('rgb(10, 20, 30)', 0.25)).toBe(
      'rgba(10, 20, 30, 0.250)'
    );
  });

  it('expands both hex forms', () => {
    expect(withAlphaFactor('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.500)');
    expect(withAlphaFactor('#17181cff', 0.5)).toBe('rgba(23, 24, 28, 0.500)');
  });

  it('leaves a fully transparent plate alone', () => {
    expect(withAlphaFactor('transparent', 0.5)).toBe('transparent');
  });
});
