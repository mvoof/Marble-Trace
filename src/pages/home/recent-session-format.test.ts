import { describe, expect, it } from 'vitest';

import { finishText } from './recent-session-format';

describe('finishText', () => {
  it('names the place and the field, the place alone when the field is unknown', () => {
    expect(finishText({ finishPos: 14, fieldSize: 48 })).toBe('P14 / 48');
    expect(finishText({ finishPos: 6, fieldSize: null })).toBe('P6');
  });

  it('is nothing without a finish', () => {
    expect(finishText({ finishPos: null, fieldSize: 20 })).toBeNull();
  });
});
