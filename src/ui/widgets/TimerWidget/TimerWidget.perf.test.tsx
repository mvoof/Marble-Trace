import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'timer' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | TimerFooter        | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  TimerFooter: {
    budget: 60,
    target: 1,
    note: 'Debt: the footer wakes per entries frame.',
  },
};

describe('TimerWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('timer', BUDGETS);
  });
});
