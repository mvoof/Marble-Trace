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
 * | RelativeContent | 1 | ok |
 * | DriverRow | 3 | ok |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RelativeContent: { budget: 1 },
  DriverRow: { budget: 3 },
};

describe('RelativeWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('relative', BUDGETS);
  });
});
