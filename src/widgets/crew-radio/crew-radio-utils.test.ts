import { describe, expect, it } from 'vitest';

import type { CrewRadioLine } from '@entities/crew-radio/crew-radio.store';
import { visibleCrewRadioLines } from './crew-radio-utils';

const line = (
  id: number,
  speaker: CrewRadioLine['speaker']
): CrewRadioLine => ({
  id,
  speaker,
  text: `line ${id}`,
  result: null,
  onAir: false,
});

const LINES = [
  line(1, 'driver'),
  line(2, 'engineer'),
  line(3, 'driver'),
  line(4, 'engineer'),
];

const idsOf = (lines: CrewRadioLine[]) => lines.map((shown) => shown.id);

describe('visibleCrewRadioLines', () => {
  it('shows the last line alone in the current-only view', () => {
    const shown = visibleCrewRadioLines(LINES, false, {
      history: 'current',
      recentCount: 3,
      hideDriverLines: false,
    });

    expect(idsOf(shown)).toEqual([4]);
  });

  it('gives the whole current-only plate to a press', () => {
    const shown = visibleCrewRadioLines(LINES, true, {
      history: 'current',
      recentCount: 3,
      hideDriverLines: false,
    });

    expect(shown).toEqual([]);
  });

  it('keeps a slot for the press among the recent lines', () => {
    const shown = visibleCrewRadioLines(LINES, true, {
      history: 'recent',
      recentCount: 3,
      hideDriverLines: false,
    });

    expect(idsOf(shown)).toEqual([3, 4]);
  });

  it('leaves the driver out when asked', () => {
    const shown = visibleCrewRadioLines(LINES, false, {
      history: 'recent',
      recentCount: 3,
      hideDriverLines: true,
    });

    expect(idsOf(shown)).toEqual([2, 4]);
  });
});
