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
 * | EngineCluster | 1 | ok |
 * | ShiftBar | 1 | ok |
 * | GearReadout | 1 | ok |
 * | RaceCluster | 1 | ok |
 */
const BUDGETS: Record<string, RenderBudget> = {
  EngineCluster: { budget: 1 },
  ShiftBar: { budget: 1 },
  GearReadout: { budget: 1 },
  RaceCluster: { budget: 1 },
};

describe('InvisibleDashWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('invisible-dash', BUDGETS);
  });
});
