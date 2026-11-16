import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  headingDegreesAt,
  joinDegrees,
  nearestPoint,
  noseDegreesAt,
  originOf,
  projectPath,
  svgPathOf,
} from './map-projection';

// Equator: a degree is the same both ways but for the two constants.
const lat = new Float32Array([0, 0, 0.001, 0.001]);
const lon = new Float32Array([0, 0.001, 0.001, 0.002]);

describe('projectPath', () => {
  it('puts east right and north up, a fix-less point nowhere', () => {
    const origin = originOf(lat, lon);
    const path = projectPath(lat, lon, origin ?? [0, 0]);

    expect(origin).toEqual([0, lon[1]]);
    expect(path.fixed).toEqual(new Uint8Array([0, 1, 1, 1]));
    expect(path.xs[3]).toBeCloseTo(111.32, 1);
    expect(path.ys[2]).toBeCloseTo(-110.54, 1);
  });
});

describe('joinDegrees', () => {
  it('adds back the rest a f32 lost', () => {
    const degrees = 41.570_123_456_789;
    const narrowed = Math.fround(degrees);
    const joined = joinDegrees(
      new Float32Array([narrowed]),
      new Float32Array([degrees - narrowed])
    );

    expect(Math.abs(joined[0] - degrees)).toBeLessThan(1e-10);
    expect(joinDegrees(new Float32Array([narrowed]), null)[0]).toBe(narrowed);
  });
});

describe('noseDegreesAt', () => {
  it('turns a heading from north into a rotation from east', () => {
    const path = {
      ...projectPath(lat, lon, [0, 0]),
      headings: new Float32Array([0, Math.PI / 2, Math.PI, 0]),
    };

    expect(noseDegreesAt(path, 0)).toBeCloseTo(-90);
    expect(noseDegreesAt(path, 1)).toBeCloseTo(0);
    expect(noseDegreesAt(path, 2)).toBeCloseTo(90);
  });
});

describe('boundsOf and svgPathOf', () => {
  it('cover the fixed points of the stretch asked for', () => {
    const path = projectPath(lat, lon, [0, 0]);

    expect(boundsOf(path, 2, 3)).toEqual({
      minX: path.xs[2],
      minY: path.ys[2],
      maxX: path.xs[3],
      maxY: path.ys[3],
    });
    expect(svgPathOf(path).startsWith('M')).toBe(true);
    expect(svgPathOf(path).split('M')).toHaveLength(2);
  });
});

describe('nearestPoint', () => {
  it('finds the nearest point within reach, none beyond it', () => {
    const path = projectPath(lat, lon, [0, 0]);

    expect(nearestPoint(path, path.xs[3] + 1, path.ys[3], 5)).toBe(3);
    expect(nearestPoint(path, 1_000, 1_000, 5)).toBeNull();
  });
});

describe('headingDegreesAt', () => {
  const straight = (dx: number, dy: number) => ({
    xs: Float32Array.from({ length: 10 }, (_, index) => index * dx),
    ys: Float32Array.from({ length: 10 }, (_, index) => index * dy),
    fixed: new Uint8Array(10).fill(1),
  });

  it('reads the direction of travel, clockwise from east with y down', () => {
    expect(headingDegreesAt(straight(1, 0), 5)).toBeCloseTo(0);
    expect(headingDegreesAt(straight(0, 1), 5)).toBeCloseTo(90);
    expect(headingDegreesAt(straight(-1, 0), 5)).toBeCloseTo(180);
    expect(headingDegreesAt(straight(0, -1), 0)).toBeCloseTo(-90);
  });
});
