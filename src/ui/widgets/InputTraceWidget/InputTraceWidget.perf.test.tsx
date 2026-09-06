import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'input-trace' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | Bar                | 3      | ok    |
 * | SteeringWheel      | 1      | ok    |
 * | WheelCenter        | 1      | ok    |
 */
const BUDGETS: Record<string, RenderBudget> = {
  Bar: { budget: 3 },
  SteeringWheel: { budget: 1 },
  WheelCenter: { budget: 1 },
};

describe('InputTraceWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('input-trace', BUDGETS);
  });
});
