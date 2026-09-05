import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'track-map' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | TrackMapView       | 60     | debt (target 1) |
 * | TrackMapSvg        | 61     | debt (target 1) |
 * | CarDot             | 59     | debt (target 1) |
 * | FlagZones          | 1      | ok |
 * | FlagZoneStripes    | 1      | ok |
 * | CrownIcon          | 1      | ok |
 * | ChevronIcon        | 1      | ok |
 */
const BUDGETS: Record<string, RenderBudget> = {
  TrackMapView: {
    budget: 60,
    target: 1,
    note: 'Debt: the view wakes per positions frame.',
  },
  TrackMapSvg: {
    budget: 61,
    target: 1,
    note: 'Debt: the whole svg wakes per positions frame.',
  },
  CarDot: {
    budget: 59,
    target: 1,
    note: 'Debt: the dot re-renders instead of writing its transform.',
  },
  FlagZones: { budget: 1 },
  FlagZoneStripes: { budget: 1 },
  CrownIcon: { budget: 1 },
  ChevronIcon: { budget: 1 },
};

describe('TrackMapWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('track-map', BUDGETS);
  });
});
