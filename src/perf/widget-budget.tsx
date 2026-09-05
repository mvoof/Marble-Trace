import { createElement } from 'react';

import { WIDGET_BY_ID } from '@store/widget-catalog';
import { componentForWidget } from '@ui/widgets/registry';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import type { RootStore } from '@store/root-store';
import { hotFieldsOf } from './hot-fields';
import { buildHotFieldBurst, type BurstStep } from './telemetry-bursts';
import {
  assertRenderBudgets,
  measureRenderBudget,
  type RenderBudget,
  type RenderBudgetReport,
} from './render-budget';

/**
 * One widget's render budget, measured the same way for every widget: mount the
 * widget the catalog names, advance every hot field its own manifest declares,
 * and assert the wake-ups against the table the test carries.
 *
 * The fields come from the manifest rather than from the test, so a widget that
 * starts reading another hot field is measured against it without the test
 * being edited.
 */

/** One second of telemetry. Long enough to tell "once per frame" from "once". */
export const BURST_FRAMES = 60;

export interface WidgetBudgetOptions {
  /** Extra seeding on top of the preview scenario, if the widget needs it. */
  seed?: (store: RootStore) => void;
  /** The preview scenario to seed from; the baseline unless a test says otherwise. */
  scenarioId?: string;
  /** How many frames to replay; one second unless a test needs longer. */
  frames?: number;
}

export const measureWidgetRenderBudget = async (
  widgetId: string,
  { seed, scenarioId, frames = BURST_FRAMES }: WidgetBudgetOptions = {}
): Promise<RenderBudgetReport> => {
  const manifest = WIDGET_BY_ID.get(widgetId);

  if (!manifest) {
    throw new Error(`Render budget: no widget is registered as '${widgetId}'.`);
  }

  const hotFields = hotFieldsOf(manifest);

  if (hotFields.length === 0) {
    throw new Error(
      `Render budget: '${widgetId}' declares no hot telemetry field, so it ` +
        'carries no budget. Remove the perf test, or declare the field.'
    );
  }

  const component = componentForWidget(widgetId);

  if (!component) {
    throw new Error(`Render budget: '${widgetId}' has no mounted component.`);
  }

  return measureRenderBudget<BurstStep>({
    // The id every real mount site provides. Without it a widget that reads
    // its settings by instance id — the canvas ones do, inside their draw loop
    // — resolves nothing and throws where only MobX can see it.
    ui: () =>
      createElement(
        WidgetIdContext.Provider,
        { value: widgetId },
        createElement(component)
      ),
    burst: (store) => buildHotFieldBurst(store, hotFields, frames),
    applyFrame: (store, step) => step(store),
    seed,
    scenarioId,
  });
};

/**
 * The whole of a widget's budget test: measure, then assert. Anything a widget
 * needs beyond this — a scenario of its own, or a read of what the reactive-DOM
 * bypass actually wrote — reaches for `measureRenderBudget` directly.
 */
export const expectWidgetRenderBudget = async (
  widgetId: string,
  budgets: Record<string, RenderBudget>,
  options?: WidgetBudgetOptions
): Promise<RenderBudgetReport> => {
  const report = await measureWidgetRenderBudget(widgetId, options);

  assertRenderBudgets(report, budgets);

  return report;
};
