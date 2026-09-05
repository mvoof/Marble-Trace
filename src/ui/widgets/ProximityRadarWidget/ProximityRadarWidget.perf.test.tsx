import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'proximity-radar' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | RadarScope         | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RadarScope: {
    budget: 60,
    target: 1,
    note: 'Debt: the scope re-renders per proximity frame.',
  },
};

describe('ProximityRadarWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('proximity-radar', BUDGETS);
  });
});
