import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  nearestPoint,
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
