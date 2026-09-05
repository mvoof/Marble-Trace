import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'relative-map' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | LinearMap          | 60     | debt (target 1) |
 * | FlagBands          | 59     | debt (target 0) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  LinearMap: {
    budget: 60,
    target: 1,
    note: 'Debt: the whole map wakes per positions frame.',
  },
  FlagBands: {
    budget: 59,
    target: 0,
    note: 'Debt: the bands do not move with the cars.',
  },
};

describe('RelativeMapWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('relative-map', BUDGETS);
  });
});
