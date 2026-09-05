import { describe, it } from 'vitest';

import type { RenderBudget } from '@/perf/render-budget';
import { expectWidgetRenderBudget } from '@/perf/widget-budget';
import type { CloseBattleWidgetSettings } from '@/types/widget-settings';
import { CLOSE_BATTLE_MANIFEST } from './manifest';

/**
 * Render budget for the 'close-battle' widget: every hot field its manifest
 * declares is advanced once per frame of a one-second burst. See
 * `docs/rendering.md` for what the numbers mean and how to move one.
 *
 * | component          | budget | state |
 * | ------------------ | ------ | ----- |
 * | CloseBattleWidget  | 2      | ok |
 * | BattleAxis         | 1      | ok |
 * | BattleRow          | 2      | ok |
 */
const BUDGETS: Record<string, RenderBudget> = {
  CloseBattleWidget: { budget: 2 },
  BattleAxis: { budget: 1 },
  BattleRow: { budget: 2 },
};

describe('CloseBattleWidget render budget', () => {
  it('stays inside its budget over a burst of telemetry', async () => {
    await expectWidgetRenderBudget('close-battle', BUDGETS, {
      scenarioId: 'close-battle',
      // The widget leaves the screen outside a race, and the sample snapshot is
      // not one, so without this it renders nothing and measures nothing.
      seed: (store) => {
        store.widgetSettings.updateUserSettings('close-battle', {
          ...(CLOSE_BATTLE_MANIFEST.userSettings as unknown as CloseBattleWidgetSettings),
          raceOnly: false,
        });
      },
    });
  });
});
