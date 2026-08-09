import { describe, expect, it } from 'vitest';

import {
  carDotRect,
  shapeForClassOrder,
  type CarDotShape,
} from './car-dot-shape';

const RADIUS = 10;
const ROUNDED: Exclude<CarDotShape, 'circle'>[] = ['square', 'diamond'];

describe('shapeForClassOrder', () => {
  it('keeps the circle for the fastest class and for an unknown one', () => {
    expect(shapeForClassOrder(0)).toBe('circle');
    expect(shapeForClassOrder(-1)).toBe('circle');
  });

  it('gives each of the first three classes a distinct shape', () => {
    const shapes = [0, 1, 2].map(shapeForClassOrder);

    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('cycles once the classes outnumber the shapes', () => {
    expect(shapeForClassOrder(3)).toBe(shapeForClassOrder(0));
    expect(shapeForClassOrder(4)).toBe(shapeForClassOrder(1));
  });
});

describe('carDotRect', () => {
  it('returns nothing for a circle, which is drawn as one', () => {
    expect(carDotRect('circle', RADIUS)).toBeNull();
  });

  it.each(ROUNDED)('leaves %s enough room for the car number', (shape) => {
    const rect = carDotRect(shape, RADIUS);

    expect(rect?.halfSide).toBeGreaterThan(RADIUS * 0.75);
  });

  it.each(ROUNDED)('rounds the corners of %s', (shape) => {
    const rect = carDotRect(shape, RADIUS);

    expect(rect?.cornerRadius).toBeGreaterThan(0);
    expect(rect?.cornerRadius).toBeLessThan(rect?.halfSide ?? 0);
  });

  it('tilts only the diamond, so the car number stays upright', () => {
    expect(carDotRect('square', RADIUS)?.rotationDeg).toBe(0);
    expect(carDotRect('diamond', RADIUS)?.rotationDeg).toBe(45);
  });
});
