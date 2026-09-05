import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'engine-panel' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | AbsCell            | 60     | debt (target 0) |
 * | EngineCell         | 60     | debt (target 0) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  AbsCell: {
    budget: 60,
    target: 0,
    note: 'Debt: the ABS setting did not change during the burst.',
  },
  EngineCell: {
    budget: 60,
    target: 0,
    note: 'Debt: the engine map did not change during the burst.',
  },
};

describe('EnginePanelWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('engine-panel', BUDGETS);
  });
});
