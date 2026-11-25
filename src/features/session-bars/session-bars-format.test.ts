import { describe, expect, it } from 'vitest';
import { buildLapProgress } from './session-bars-format';

describe('buildLapProgress', () => {
  it('returns nothing before any car has a lap', () => {
    expect(buildLapProgress(null, '45', false)).toBeNull();
  });

  it('shows the leader lap alone when the session has no length', () => {
    expect(buildLapProgress(7, null, true)).toEqual({
      value: '7',
      isFinalLap: false,
      widthChars: 1,
    });
  });

  it('announces the final lap of a lap-limited race', () => {
    expect(buildLapProgress(45, '45', false)).toEqual({
      value: 'FINAL',
      isFinalLap: true,
      widthChars: 5,
    });
  });

  it('marks an estimated total and never calls it a final lap', () => {
    expect(buildLapProgress(20, '20', true)).toEqual({
      value: '20/~20',
      isFinalLap: false,
      widthChars: 6,
    });
  });

  it('reserves the width of the value it renders', () => {
    expect(buildLapProgress(9, '45', false)).toEqual({
      value: '9/45',
      isFinalLap: false,
      widthChars: 5,
    });
  });
});
