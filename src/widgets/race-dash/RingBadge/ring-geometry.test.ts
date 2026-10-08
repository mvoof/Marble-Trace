import { describe, it, expect } from 'vitest';
import {
  RIM_MARKER_RADIUS,
  RING_SIZE,
  rimPoint,
  rimTrailPath,
  ringTickSegment,
} from './ring-geometry';

const CENTER = RING_SIZE / 2;

// "A rx ry rotation largeArc sweep x y" — the two flags are what decides which
// of the four arcs between the endpoints actually gets drawn.
const arcFlags = (path: string) => {
  const [, largeArc, sweep] = /A [\d.]+ [\d.]+ 0 (\d) (\d)/.exec(path) ?? [];

  return { largeArc, sweep };
};

describe('rimPoint', () => {
  it("measures clockwise from 12 o'clock", () => {
    const top = rimPoint(0, RIM_MARKER_RADIUS);
    expect(top.x).toBeCloseTo(CENTER);
    expect(top.y).toBeCloseTo(CENTER - RIM_MARKER_RADIUS);

    const right = rimPoint(90, RIM_MARKER_RADIUS);
    expect(right.x).toBeCloseTo(CENTER + RIM_MARKER_RADIUS);
    expect(right.y).toBeCloseTo(CENTER);

    const left = rimPoint(-90, RIM_MARKER_RADIUS);
    expect(left.x).toBeCloseTo(CENTER - RIM_MARKER_RADIUS);
    expect(left.y).toBeCloseTo(CENTER);
  });

  it('stays inside the badge so the marker cannot clip its edge', () => {
    expect(RIM_MARKER_RADIUS).toBeLessThan(CENTER);
  });
});

describe('rimTrailPath', () => {
  it("starts at 12 o'clock whichever way the wheel was turned", () => {
    const top = rimPoint(0, RIM_MARKER_RADIUS);
    const expectedStart = `M ${top.x.toFixed(3)} ${top.y.toFixed(3)}`;

    expect(rimTrailPath(90, RIM_MARKER_RADIUS).startsWith(expectedStart)).toBe(
      true
    );
    expect(rimTrailPath(-90, RIM_MARKER_RADIUS).startsWith(expectedStart)).toBe(
      true
    );
  });

  it('sweeps in the direction the wheel actually travelled', () => {
    expect(arcFlags(rimTrailPath(90, RIM_MARKER_RADIUS)).sweep).toBe('1');
    expect(arcFlags(rimTrailPath(-90, RIM_MARKER_RADIUS)).sweep).toBe('0');
  });

  it('takes the long way round past a half turn instead of flipping sides', () => {
    expect(arcFlags(rimTrailPath(90, RIM_MARKER_RADIUS)).largeArc).toBe('0');
    expect(arcFlags(rimTrailPath(270, RIM_MARKER_RADIUS)).largeArc).toBe('1');
    expect(arcFlags(rimTrailPath(-270, RIM_MARKER_RADIUS)).largeArc).toBe('1');
  });

  it('ends where the marker sits, so the trail meets the dot', () => {
    const end = rimPoint(135, RIM_MARKER_RADIUS);

    expect(
      rimTrailPath(135, RIM_MARKER_RADIUS).endsWith(
        `${end.x.toFixed(3)} ${end.y.toFixed(3)}`
      )
    ).toBe(true);
  });
});

describe('ringTickSegment', () => {
  const lengthOf = ({
    x1,
    y1,
    x2,
    y2,
  }: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }) => Math.hypot(x2 - x1, y2 - y1);

  it('spans the full thickness of the arc band, radially', () => {
    expect(lengthOf(ringTickSegment(0))).toBeCloseTo(8, 6);
    expect(lengthOf(ringTickSegment(150))).toBeCloseTo(8, 6);
  });

  it("starts the sweep at -120° from 12 o'clock, like the fill arc", () => {
    const { x1, x2 } = ringTickSegment(0);

    expect(x1).toBeLessThan(CENTER);
    expect(x2).toBeLessThan(x1);
  });

  it('ends the 300° sweep at 6 o’clock, closing the ring', () => {
    const end = ringTickSegment(300);

    expect(end.x1).toBeCloseTo(CENTER, 6);
    expect(end.y1).toBeGreaterThan(CENTER);
  });
});
