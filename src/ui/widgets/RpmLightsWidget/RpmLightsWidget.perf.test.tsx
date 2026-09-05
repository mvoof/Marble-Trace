import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'rpm-lights' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | RpmLightsWidget    | 61     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RpmLightsWidget: {
    budget: 61,
    target: 1,
    note: 'Debt: the widget root reads rpm, so the whole tree wakes with it.',
  },
};

describe('RpmLightsWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('rpm-lights', BUDGETS);
  });
});
