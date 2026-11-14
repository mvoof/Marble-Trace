import { describe, expect, it } from 'vitest';

import { categoryLook, changeLabel, licenceClass } from './home-format';

describe('licenceClass', () => {
  it('reads the class from the letter', () => {
    expect(
      ['R 2.10', 'D 1.00', 'C 3.10', 'B 3.74', 'A 4.99', 'P 4.20'].map(
        licenceClass
      )
    ).toEqual(['R', 'D', 'C', 'B', 'A', 'Pro']);
  });
});

describe('categoryLook', () => {
  it('knows the sim’s categories and nothing else', () => {
    expect(categoryLook('Sports Car')?.nameKey).toBe('sportsCar');
    expect(categoryLook('toString')).toBeNull();
  });
});

describe('changeLabel', () => {
  it('writes the change with its arrow, a dash for none', () => {
    expect([changeLabel(120), changeLabel(-32), changeLabel(0)]).toEqual([
      '▲ 120',
      '▼ 32',
      '—',
    ]);
    expect(changeLabel(0.034, 2)).toBe('▲ 0.03');
  });
});
