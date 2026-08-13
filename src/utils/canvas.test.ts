import { describe, expect, it } from 'vitest';

import { carDotRect, shapeForClassOrder, type CarDotShape } from './canvas';

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

  it('draws the diamond as the square, only tilted', () => {
    expect(carDotRect('diamond', RADIUS)?.halfSide).toBe(
      carDotRect('square', RADIUS)?.halfSide
    );
  });

  it('tilts only the diamond, so the car number stays upright', () => {
    expect(carDotRect('square', RADIUS)?.rotationDeg).toBe(0);
    expect(carDotRect('diamond', RADIUS)?.rotationDeg).toBe(45);
  });
});

import { scrollThumbFor } from './canvas';

describe('scrollThumbFor', () => {
  it('returns null when the whole list is on screen', () => {
    expect(scrollThumbFor({ total: 5, windowSize: 10 }, 0)).toBeNull();
    expect(scrollThumbFor({ total: 10, windowSize: 10 }, 0)).toBeNull();
  });

  it('returns null without metrics', () => {
    expect(scrollThumbFor(undefined, 0)).toBeNull();
  });

  it('sizes the thumb by the share of the list on screen', () => {
    const thumb = scrollThumbFor({ total: 40, windowSize: 10 }, 0);

    expect(thumb).toEqual({ heightPercent: 25, topPercent: 0 });
  });

  it('keeps a long list above the size floor', () => {
    const thumb = scrollThumbFor({ total: 200, windowSize: 5 }, 0);

    expect(thumb?.heightPercent).toBe(12);
  });

  it('parks a top-anchored list at the bottom on its last offset', () => {
    const thumb = scrollThumbFor({ total: 40, windowSize: 10 }, 30);

    expect(thumb).toEqual({ heightPercent: 25, topPercent: 75 });
  });

  it('parks a bottom-anchored list at the bottom on a zero offset', () => {
    const live = scrollThumbFor({ total: 40, windowSize: 10 }, 0, 'bottom');
    const oldest = scrollThumbFor({ total: 40, windowSize: 10 }, 30, 'bottom');

    expect(live?.topPercent).toBe(75);
    expect(oldest?.topPercent).toBe(0);
  });

  it('clamps an offset past the end of the travel', () => {
    const thumb = scrollThumbFor({ total: 40, windowSize: 10 }, 999);

    expect(thumb?.topPercent).toBe(75);
  });
});
