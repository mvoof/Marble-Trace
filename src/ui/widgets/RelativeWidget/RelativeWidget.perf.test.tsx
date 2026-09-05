import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'relative' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | RelativeContent    | 66     | debt (target 1) |
 * | DriverRow          | 180    | debt (target 3) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RelativeContent: {
    budget: 66,
    target: 1,
    note: 'Debt: the whole table wakes per relative frame. The budget sits a few above the 60 of the burst because the measured value drifts between 61 and 64 run to run; what wakes it those extra times is not identified, and is part of the follow-up.',
  },
  DriverRow: {
    budget: 180,
    target: 3,
    note: 'Debt: three rows; one wake each is the shape.',
  },
};

describe('RelativeWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('relative', BUDGETS);
  });
});
