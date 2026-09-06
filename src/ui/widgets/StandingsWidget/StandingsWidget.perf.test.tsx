import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';

/**
 * Render budget for the 'standings' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | StandingsContent | 1 | ok |
 * | SessionHeader | 1 | ok |
 * | ClassSwitcher | 0 | ok |
 * | ClassGroup | 1 | ok |
 * | DriverRow | 5 | ok |
 * | PositionCell | 0 | ok |
 * | PosChange | 0 | ok |
 * | IrChangeCell | 0 | ok |
 * | ScrollIndicator | 0 | ok |
 * | SessionFooter | 1 | ok |
 */
const BUDGETS: Record<string, RenderBudget> = {
  StandingsContent: { budget: 1 },
  SessionHeader: { budget: 1 },
  ClassSwitcher: { budget: 0 },
  ClassGroup: { budget: 1 },
  DriverRow: { budget: 5 },
  PositionCell: { budget: 0 },
  PosChange: { budget: 0 },
  IrChangeCell: { budget: 0 },
  ScrollIndicator: { budget: 0 },
  SessionFooter: { budget: 1 },
};

describe('StandingsWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('standings', BUDGETS);
  });
});
