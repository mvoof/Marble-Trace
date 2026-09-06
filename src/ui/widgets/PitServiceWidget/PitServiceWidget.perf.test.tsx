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
 * | PitSpeedPlate      | 0      | ok    |
 * | PitSpeedGauge      | 0      | ok    |
 * | PitLimiterRow      | 0      | ok, and unmounted with the limiter off |
 * | PitApproachRail    | 1      | ok    |
 */
const BUDGETS: Record<string, RenderBudget> = {
  PitSpeedPlate: { budget: 0 },
  PitSpeedGauge: { budget: 0 },
  PitLimiterRow: { budget: 0 },
  PitApproachRail: { budget: 1 },
};

describe('PitServiceWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('pit-service', BUDGETS);
  });
});
