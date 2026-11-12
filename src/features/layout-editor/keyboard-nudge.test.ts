import { describe, expect, it } from 'vitest';

import { largeGridStepPx, nudgedPosition } from './keyboard-nudge';

const FREE = { snap: false, size: 20 };
const GRID = { snap: true, size: 20 };

describe('nudgedPosition', () => {
  it('moves a pixel at a time without the grid, ten with Shift', () => {
    expect(nudgedPosition({ x: 33, y: 47 }, 'ArrowRight', false, FREE)).toEqual(
      { x: 34, y: 47 }
    );
    expect(nudgedPosition({ x: 33, y: 47 }, 'ArrowUp', true, FREE)).toEqual({
      x: 33,
      y: 37,
    });
  });

  it('lands on the grid before moving a cell', () => {
    expect(nudgedPosition({ x: 33, y: 47 }, 'ArrowLeft', false, GRID)).toEqual({
      x: 20,
      y: 47,
    });
    expect(nudgedPosition({ x: 33, y: 47 }, 'ArrowDown', true, GRID)).toEqual({
      x: 33,
      y: 140,
    });
  });

  it('ignores every other key', () => {
    expect(nudgedPosition({ x: 0, y: 0 }, 'Enter', false, GRID)).toBeNull();
  });

  it('names the Shift step only on the grid', () => {
    expect(largeGridStepPx(GRID)).toBe(100);
    expect(largeGridStepPx(FREE)).toBeNull();
  });
});
