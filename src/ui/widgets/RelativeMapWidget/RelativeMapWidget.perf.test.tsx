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
 * | LinearMap          | 1      | ok    |
 * | FlagBands          | 0      | ok    |
 */
const BUDGETS: Record<string, RenderBudget> = {
  LinearMap: { budget: 1 },
  FlagBands: { budget: 0 },
};

describe('RelativeMapWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('relative-map', BUDGETS);
  });
});
