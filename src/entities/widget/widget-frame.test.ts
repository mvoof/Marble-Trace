import { describe, expect, it } from 'vitest';

import {
  resizeDirectionsFor,
  scaleFromCorner,
  widgetBoxSize,
  widgetFrameBorderRadius,
} from './widget-frame';

describe('resizeDirectionsFor', () => {
  it('offers only the corners to a content-sized widget', () => {
    expect(
      resizeDirectionsFor({ autoHeight: true, contentSized: true }).sort()
    ).toEqual(['ne', 'nw', 'se', 'sw']);
  });

  it('keeps the side handles for a widget that stretches across', () => {
    expect(resizeDirectionsFor({ autoHeight: true }).sort()).toEqual([
      'e',
      'w',
    ]);
  });
});

describe('widgetBoxSize', () => {
  it('lets a content-sized widget size its box in both axes', () => {
    expect(
      widgetBoxSize({ width: 180, height: 60, contentSized: true })
    ).toEqual({ width: 'auto', height: 'auto' });
  });

  it('keeps the stored width of an auto-height widget', () => {
    expect(widgetBoxSize({ width: 180, height: 60, autoHeight: true })).toEqual(
      { width: 180, height: 'auto' }
    );
  });
});

describe('scaleFromCorner', () => {
  // Stored 180 wide, drawn 140 by 60: the plate is narrower than its scale.
  const start = { x: 100, y: 200, width: 180, height: 60 };
  const drawn = { width: 140, height: 60 };
  const minWidth = 36;

  it('follows the pointer with the dragged corner', () => {
    const scaled = scaleFromCorner({
      direction: 'se',
      dx: 70,
      start,
      drawn,
      minWidth,
    });

    // 140 drawn + 70 dragged is 1.5×, so the stored width scales by as much.
    expect(scaled).toEqual({ x: 100, y: 200, width: 270, height: 90 });
  });

  it('keeps the opposite corner where it was', () => {
    const scaled = scaleFromCorner({
      direction: 'nw',
      dx: -70,
      start,
      drawn,
      minWidth,
    });

    // The plate grows to 210 by 90; its bottom-right stays at 240, 260.
    expect(scaled).toEqual({ x: 30, y: 170, width: 270, height: 90 });
  });

  it('stops at the smallest width', () => {
    const scaled = scaleFromCorner({
      direction: 'se',
      dx: -500,
      start,
      drawn,
      minWidth,
    });

    expect(scaled.width).toBe(minWidth);
  });

  it('leaves a widget that has not drawn yet alone', () => {
    expect(
      scaleFromCorner({
        direction: 'se',
        dx: 50,
        start,
        drawn: { width: 0, height: 0 },
        minWidth,
      })
    ).toEqual(start);
  });
});

describe('widgetFrameBorderRadius', () => {
  it('clips a scope round', () => {
    expect(widgetFrameBorderRadius('proximity-radar', {})).toBe('50%');
  });

  it('scales the corners a manifest declares', () => {
    expect(widgetFrameBorderRadius('race-dash', {})).toBe(
      'calc(52px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(52px * var(--wfs, 1))'
    );
  });

  it('keeps a shape tied to a setting only while it is on', () => {
    expect(
      widgetFrameBorderRadius('input-trace', { showSteering: false })
    ).toBe(undefined);
    expect(widgetFrameBorderRadius('input-trace', { showSteering: true })).toBe(
      'calc(12px * var(--wfs, 1)) 9999px 9999px calc(12px * var(--wfs, 1))'
    );
  });

  it('leaves a plain plate to the stylesheet', () => {
    expect(widgetFrameBorderRadius('fuel', {})).toBe(undefined);
  });
});
