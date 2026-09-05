import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'weather' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | WindArrow          | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  WindArrow: {
    budget: 60,
    target: 1,
    note: 'Debt: reads the heading in render; the same row as WindCompass.perf.test.tsx.',
  },
};

describe('WeatherWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('weather', BUDGETS);
  });
});
