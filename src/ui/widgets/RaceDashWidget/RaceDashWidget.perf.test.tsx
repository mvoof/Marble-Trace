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
 * | RaceDashWidget     | 60     | debt (target 1) |
 * | RingBadge          | 60     | debt (target 1) |
 * | SteeringMarker     | 60     | debt (target 1) |
 * | StatsStrip         | 60     | debt (target 1) |
 * | SpeedReadout       | 60     | debt (target 1) |
 * | RpmValue           | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RaceDashWidget: {
    budget: 60,
    target: 1,
    note: 'Debt: the widget root reads a hot field, against the rule.',
  },
  RingBadge: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders for the gear ring.',
  },
  SteeringMarker: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders for the wheel angle instead of writing it.',
  },
  StatsStrip: {
    budget: 60,
    target: 1,
    note: 'Debt: the strip wakes for the numbers inside it.',
  },
  SpeedReadout: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders every frame for one number.',
  },
  RpmValue: {
    budget: 60,
    target: 1,
    note: 'Debt: re-renders every frame for one number.',
  },
};

describe('RaceDashWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('race-dash', BUDGETS);
  });
});
