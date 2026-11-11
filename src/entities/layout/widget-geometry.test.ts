import { describe, expect, it } from 'vitest';

import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

import { monitorMoveOf } from './widget-geometry';

const LEFT: LayoutMonitor = {
  name: 'LEFT',
  bounds: { x: 0, y: 0, width: 1000, height: 1000 },
};

const RIGHT: LayoutMonitor = {
  name: 'RIGHT',
  bounds: { x: 1000, y: 0, width: 1000, height: 1000 },
};

const onLeft = (): WidgetDefaultConfig =>
  ({
    id: 'fuel',
    type: 'fuel',
    monitor: 'LEFT',
    userSettings: {
      enabled: true,
      x: 100,
      y: 200,
      currentWidth: 100,
      currentHeight: 100,
    },
  }) as WidgetDefaultConfig;

describe('monitorMoveOf', () => {
  it('keeps the relative place on the target monitor', () => {
    expect(monitorMoveOf(onLeft(), [LEFT, RIGHT], 'RIGHT')).toEqual({
      monitor: 'RIGHT',
      x: 1100,
      y: 200,
    });
  });

  it('is null for the monitor it already stands on, or one the layout lacks', () => {
    expect(monitorMoveOf(onLeft(), [LEFT, RIGHT], 'LEFT')).toBeNull();
    expect(monitorMoveOf(onLeft(), [LEFT, RIGHT], 'MISSING')).toBeNull();
  });
});
