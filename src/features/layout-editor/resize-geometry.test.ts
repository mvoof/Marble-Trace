import { describe, expect, it } from 'vitest';

import { dragPosition, resizeBox, type ResizeInput } from './resize-geometry';

describe('dragPosition', () => {
  const start = { x: 100, y: 100 };
  const size = { width: 200, height: 100 };
  const snap = {
    gridSize: 20,
    area: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  it('moves with the pointer, rounded', () => {
    expect(dragPosition({ dx: 12.4, dy: -7.6, start, size })).toEqual({
      x: 112,
      y: 92,
    });
  });

  it('puts the position on the grid with snapping on', () => {
    expect(dragPosition({ dx: 13, dy: 7, start, size, snap })).toEqual({
      x: 120,
      y: 100,
    });
  });

  it('centres on the screen when close to its centre lines', () => {
    const position = dragPosition({
      dx: 745,
      dy: 383,
      start,
      size,
      snap,
    });

    expect(position).toEqual({ x: 860, y: 490 });
  });
});

const base: Omit<ResizeInput, 'direction' | 'dx' | 'dy'> = {
  start: { x: 100, y: 100, width: 200, height: 100 },
  drawn: { width: 200, height: 100 },
  design: { width: 200, height: 100 },
  widget: {},
};

describe('resizeBox', () => {
  it('moves the east edge with the pointer', () => {
    expect(resizeBox({ ...base, direction: 'e', dx: 50, dy: 0 })).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 100,
    });
  });

  it('keeps the east edge in place when dragging the west one', () => {
    expect(resizeBox({ ...base, direction: 'w', dx: 50, dy: 0 })).toEqual({
      x: 150,
      y: 100,
      width: 150,
      height: 100,
    });
  });

  it('stops at a fifth of the design size', () => {
    const box = resizeBox({ ...base, direction: 'se', dx: -500, dy: -500 });

    expect(box.width).toBe(40);
    expect(box.height).toBe(20);
  });

  it('snaps to the editor grid', () => {
    const box = resizeBox({
      ...base,
      direction: 'se',
      dx: 13,
      dy: 7,
      snapGrid: 20,
    });

    expect(box).toEqual({ x: 100, y: 100, width: 220, height: 100 });
  });

  it('derives the height from the design ratio of an aspect-locked widget', () => {
    const box = resizeBox({
      ...base,
      direction: 'ne',
      dx: 100,
      dy: 0,
      widget: { lockAspectRatio: true },
    });

    expect(box).toEqual({ x: 100, y: 50, width: 300, height: 150 });
  });

  it('only stretches a widget scaled from its height on a side handle', () => {
    const box = resizeBox({
      ...base,
      direction: 'e',
      dx: 100,
      dy: 40,
      widget: { scaleFromHeight: true },
    });

    expect(box.height).toBe(100);
  });

  it('keeps the shape when asked to', () => {
    const box = resizeBox({
      ...base,
      direction: 's',
      dx: 0,
      dy: 50,
      keepRatio: true,
    });

    expect(box).toEqual({ x: 100, y: 100, width: 300, height: 150 });
  });
});
