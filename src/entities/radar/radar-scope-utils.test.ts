import { describe, expect, it } from 'vitest';

import {
  axisLabelStep,
  beamPresence,
  carBearingSpan,
  labelDistanceInside,
  collapseLaneRows,
  rangeRingRadii,
  readableOn,
} from './radar-scope-utils';

const CAR_LENGTH_M = 4.6;

describe('rangeRingRadii', () => {
  it('follows the scope: one ring at half of it, the rim left to the plate', () => {
    expect(rangeRingRadii(10)).toEqual([5]);
    expect(rangeRingRadii(20)).toEqual([10]);
  });
});

describe('carBearingSpan', () => {
  it('widens as the opponent closes in', () => {
    const near = carBearingSpan(0, 6, CAR_LENGTH_M);
    const far = carBearingSpan(0, 20, CAR_LENGTH_M);

    expect(near.half).toBeGreaterThan(far.half);
  });

  it('points at the opponent, not at its side of the car', () => {
    const ahead = carBearingSpan(0, 8, CAR_LENGTH_M);
    const left = carBearingSpan(-3.4, 0, CAR_LENGTH_M);

    expect(ahead.center).toBeCloseTo(0, 5);
    expect(left.center).toBeCloseTo(-Math.PI / 2, 1);
  });
});

describe('collapseLaneRows', () => {
  it('counts cars sharing a row rather than inventing a column', () => {
    expect(
      collapseLaneRows([
        { longitudinal: 0.4, carIdx: 3 },
        { longitudinal: 1.1, carIdx: 7 },
      ])
    ).toEqual([{ longitudinal: 0.4, count: 2, carIdx: 3 }]);
  });

  it('keeps a queue as separate rows, nearest first', () => {
    expect(
      collapseLaneRows([
        { longitudinal: -5.5, carIdx: 3 },
        { longitudinal: 0.5, carIdx: 7 },
      ])
    ).toEqual([
      { longitudinal: 0.5, count: 1, carIdx: 7 },
      { longitudinal: -5.5, count: 1, carIdx: 3 },
    ]);
  });
});

describe('axisLabelStep', () => {
  it('picks a round step in the unit the driver reads', () => {
    expect(axisLabelStep(10, 'metric')).toBe(5);
    expect(axisLabelStep(10, 'imperial')).toBe(15);
    expect(axisLabelStep(5, 'metric')).toBe(2);
  });
});

describe('beamPresence', () => {
  it('is nothing on the rim and grows to full inside it', () => {
    expect(beamPresence(12, 10)).toBe(0);
    expect(beamPresence(10, 10)).toBe(0);
    expect(beamPresence(8, 10)).toBeGreaterThan(0);
    expect(beamPresence(8, 10)).toBeLessThan(1);
    expect(beamPresence(3, 10)).toBe(1);
  });
});

describe('readableOn', () => {
  it('goes dark on a light body and light on a dark one', () => {
    expect(readableOn('rgba(250, 250, 250, 0.82)')).toContain('8, 9, 10');
    expect(readableOn('#1b1d21')).toContain('250, 250, 250');
  });
});

describe('labelDistanceInside', () => {
  const LIMIT = 100;

  it('insets a label at the top or bottom by its half height', () => {
    expect(labelDistanceInside(LIMIT, 0, 20, 8)).toBeCloseTo(92);
    expect(labelDistanceInside(LIMIT, Math.PI, 20, 8)).toBeCloseTo(92);
  });

  it('insets a label on either side by its half width', () => {
    expect(labelDistanceInside(LIMIT, Math.PI / 2, 20, 8)).toBeCloseTo(80);
    expect(labelDistanceInside(LIMIT, -Math.PI / 2, 20, 8)).toBeCloseTo(80);
  });
});
