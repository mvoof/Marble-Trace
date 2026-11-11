import { describe, expect, it } from 'vitest';

import { cx } from './class-names';

describe('cx', () => {
  it('joins the names that are set', () => {
    expect(cx('row', false, 'player', '', null, undefined, 'odd')).toBe(
      'row player odd'
    );
  });

  it('gives an empty string for nothing set', () => {
    expect(cx(false, '')).toBe('');
  });
});
