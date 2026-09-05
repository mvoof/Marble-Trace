import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'pit-service' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | PitSpeedPlate      | 60     | debt (target 1) |
 * | PitApproachRail    | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  PitSpeedPlate: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders for the speed instead of writing it.',
  },
  PitApproachRail: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders for the approach distance.',
  },
};

describe('PitServiceWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('pit-service', BUDGETS);
  });
});
