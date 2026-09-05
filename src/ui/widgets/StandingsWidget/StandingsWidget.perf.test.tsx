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
 * | StandingsContent   | 66     | debt (target 1) |
 * | SessionHeader      | 60     | debt (target 1) |
 * | ClassSwitcher      | 60     | debt (target 0) |
 * | ClassGroup         | 60     | debt (target 1) |
 * | DriverRow          | 300    | debt (target 5) |
 * | PositionCell       | 300    | debt (target 0) |
 * | PosChange          | 300    | debt (target 0) |
 * | IrChangeCell       | 300    | debt (target 0) |
 * | ScrollIndicator    | 60     | debt (target 0) |
 * | SessionFooter      | 60     | debt (target 1) |
 */
const BUDGETS: Record<string, RenderBudget> = {
  StandingsContent: {
    budget: 66,
    target: 1,
    note: 'Debt: the whole table wakes per entries frame. The budget sits above the 60 of the burst because the measured value drifts between 64 and 65 run to run.',
  },
  SessionHeader: {
    budget: 60,
    target: 1,
    note: 'Debt: the header text does not change with the entries.',
  },
  ClassSwitcher: {
    budget: 60,
    target: 0,
    note: 'Debt: nothing it renders changed during the burst.',
  },
  ClassGroup: {
    budget: 60,
    target: 1,
    note: 'Debt: the group wakes for rows it only contains.',
  },
  DriverRow: {
    budget: 300,
    target: 5,
    note: 'Debt: five rows; one wake each is the shape, one each per frame is what happens.',
  },
  PositionCell: {
    budget: 300,
    target: 0,
    note: 'Debt: positions did not change during the burst.',
  },
  PosChange: {
    budget: 300,
    target: 0,
    note: 'Debt: nothing it renders changed during the burst.',
  },
  IrChangeCell: {
    budget: 300,
    target: 0,
    note: 'Debt: nothing it renders changed during the burst.',
  },
  ScrollIndicator: {
    budget: 60,
    target: 0,
    note: 'Debt: nothing it renders changed during the burst.',
  },
  SessionFooter: {
    budget: 60,
    target: 1,
    note: 'Debt: the footer text does not change with the entries.',
  },
};

describe('StandingsWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('standings', BUDGETS);
  });
});
