import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'rpm-lights' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | RpmLightsWidget    | 0      | ok    |
 * | RpmBar             | 0      | ok    |
 * | PitBar             | 0      | ok, and unmounted off pit road |
 */
const BUDGETS: Record<string, RenderBudget> = {
  RpmLightsWidget: { budget: 0 },
  RpmBar: { budget: 0 },
  PitBar: { budget: 0 },
};

describe('RpmLightsWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('rpm-lights', BUDGETS);
  });
});
