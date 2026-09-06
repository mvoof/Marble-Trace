import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'sector-matrix' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | SectorHeader       | 1      | ok    |
 * | SectorGrid         | 1      | ok    |
 */
const BUDGETS: Record<string, RenderBudget> = {
  SectorHeader: { budget: 1 },
  SectorGrid: { budget: 1 },
};

describe('SectorMatrixWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('sector-matrix', BUDGETS);
  });
});
