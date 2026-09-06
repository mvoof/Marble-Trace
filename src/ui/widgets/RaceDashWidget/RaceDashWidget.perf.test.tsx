import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'race-dash' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | RaceDashWidget | 1 | ok |
 * | RingBadge | 1 | ok |
 * | SteeringMarker | 1 | ok |
 * | StatsStrip | 1 | ok |
 * | SpeedReadout | 1 | ok |
 * | RpmValue | 1 | ok |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RaceDashWidget: { budget: 1 },
  RingBadge: { budget: 1 },
  SteeringMarker: { budget: 1 },
  StatsStrip: { budget: 1 },
  SpeedReadout: { budget: 1 },
  RpmValue: { budget: 1 },
};

describe('RaceDashWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('race-dash', BUDGETS);
  });
});
