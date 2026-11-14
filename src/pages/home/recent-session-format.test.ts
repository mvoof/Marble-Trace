import { describe, expect, it } from 'vitest';

import { finishLabel } from './recent-session-format';

describe('finishLabel', () => {
  it('names the place and the field', () => {
    expect(
      finishLabel({ eventType: 'Race', finishPos: 14, fieldSize: 48 })
    ).toEqual({
      kind: 'place',
      text: 'P14 / 48',
    });
  });

  it('names the place alone when the field is unknown', () => {
    expect(
      finishLabel({ eventType: 'Race', finishPos: 6, fieldSize: null })
    ).toEqual({
      kind: 'place',
      text: 'P6',
    });
  });

  it('names the event when there was no race to finish', () => {
    expect(
      finishLabel({ eventType: 'Practice', finishPos: null, fieldSize: null })
    ).toEqual({
      kind: 'event',
      eventType: 'practice',
    });
  });

  it('is a dash for a race the driver did not see the flag of', () => {
    expect(
      finishLabel({ eventType: 'Race', finishPos: null, fieldSize: 40 })
    ).toEqual({
      kind: 'none',
    });
  });
});
