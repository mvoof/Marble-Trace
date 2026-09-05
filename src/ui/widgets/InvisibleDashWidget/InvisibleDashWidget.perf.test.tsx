import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'invisible-dash' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | EngineCluster      | 60     | debt (target 1) |
 * | ShiftBar           | 45     | debt (target 1) |
 * | GearReadout        | 60     | debt (target 1) |
 * | RaceCluster        | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  EngineCluster: {
    budget: 60,
    target: 1,
    note: 'Debt: the cluster wakes for the numbers inside it.',
  },
  ShiftBar: {
    budget: 45,
    target: 1,
    note: 'Debt: re-renders for the shift level instead of writing it.',
  },
  GearReadout: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders every frame for one number.',
  },
  RaceCluster: {
    budget: 60,
    target: 1,
    note: 'Debt: the cluster wakes for the numbers inside it.',
  },
};

describe('InvisibleDashWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('invisible-dash', BUDGETS);
  });
});
