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
 * | Bar                | 180    | debt (target 3) |
 * | SteeringWheel      | 60     | debt (target 1) |
 * | WheelCenter        | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  Bar: {
    budget: 180,
    target: 3,
    note: 'Debt: one wake per bar per frame — three pedal levels, three numbers.',
  },
  SteeringWheel: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders for the wheel angle instead of writing it.',
  },
  WheelCenter: {
    budget: 60,
    target: 1,
    note: 'Debt: woken by the angle its parent renders.',
  },
};

describe('InputTraceWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('input-trace', BUDGETS);
  });
});
