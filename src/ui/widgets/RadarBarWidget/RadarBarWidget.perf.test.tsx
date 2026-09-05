import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'radar-bar' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | RadarBar           | 120    | debt (target 2) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RadarBar: {
    budget: 120,
    target: 2,
    note: 'Debt: both side bars re-render per proximity frame.',
  },
};

describe('RadarBarWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('radar-bar', BUDGETS);
  });
});
