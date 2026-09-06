import { describe, expect, it } from 'vitest';
import { createElement, Fragment } from 'react';

import { componentForWidget } from '@ui/widgets/registry';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import { HOT_TELEMETRY_FIELDS, HOT_WIDGET_IDS } from './hot-fields';
import { buildHotFieldBurst, type BurstStep } from './telemetry-bursts';
import { measureRenderBudget } from './render-budget';
import { BURST_FRAMES } from './widget-budget';

/**
 * The overlay's own number, as opposed to a widget's.
 *
 * Every per-widget budget answers "does this component wake for something it
 * does not draw". None of them answers the question the rendering work was
 * started for — whether one second of telemetry costs the whole overlay less
 * than it used to — and a sum of the budgets cannot answer it either: the
 * sanctioned `useReactiveDomWrite` bypass takes a widget's wake-ups to zero
 * while its per-frame work carries on outside React. Optimise the sum and you
 * optimise the counter.
 *
 * So this measures the assembled overlay against two things the bypass cannot
 * hide from:
 *
 * - **wake-ups**, every `observer` in every hot widget, mounted together. Work
 *   moved out of React leaves this number, which is the point of the second one.
 * - **DOM mutations**, counted by a `MutationObserver` over the same burst. A
 *   bypass write is an attribute write and lands here; so does every commit
 *   React makes. This is the number that does not care how the value reached
 *   the element.
 *
 * The burst is identical every run, but the two numbers are repeatable to very
 * different degrees, and the budgets are set accordingly.
 *
 * Wake-ups are all but exact: a widget settling its own `ResizeObserver` moves
 * them by a count or two and nothing else does.
 *
 * DOM mutations are not, because a bypass write lands on an animation frame the
 * burst does not control: run this file alone and the burst spans fewer frames
 * than when it runs behind twenty others, and the same work is written out a
 * different number of times. Observed between ~1200 and ~2200 for identical
 * code. So its budget is a coarse tripwire rather than a fine one — it is here
 * to catch markup coming back into the hot path, which shows up as a multiple,
 * not as a percentage.
 *
 * Bytes allocated would be the number this work was really about, and it is
 * deliberately not here: `performance.memory` in headless Chromium is bucketed
 * coarsely enough that a whole burst reads as a zero delta. A budget nobody can
 * fail is worse than no budget, so the two above stand in for it — the second
 * one in particular, since a DOM mutation is what most of that allocation was
 * being spent to produce.
 */

/**
 * What one second of telemetry may cost the whole overlay, measured 2026-09-06
 * with the same burst against the same mount.
 *
 * | | before the rendering work | after |
 * | - | - | - |
 * | wake-ups | 2049 | 4-6 |
 * | DOM mutations | 4518 | 1200-2200 |
 *
 * The "before" column is the commit this branch started from, and it is the
 * answer to whether the work paid off. The budgets are the "after" column with
 * the headroom a formatting change needs and no more.
 */
const OVERLAY_BUDGET = {
  wakeUps: 20,
  domMutations: 3000,
} as const;

const mountEveryHotWidget = () =>
  createElement(
    Fragment,
    null,
    ...HOT_WIDGET_IDS.map((widgetId) => {
      const component = componentForWidget(widgetId);

      if (!component) {
        throw new Error(
          `Overlay cost: '${widgetId}' has no mounted component.`
        );
      }

      return createElement(
        WidgetIdContext.Provider,
        { key: widgetId, value: widgetId },
        createElement(component)
      );
    })
  );

interface OverlayCost {
  wakeUps: number;
  domMutations: number;
}

const measureOverlayCost = async (): Promise<OverlayCost> => {
  let mutationCount = 0;

  const countingObserver = new MutationObserver((records) => {
    mutationCount += records.length;
  });

  const report = await measureRenderBudget<BurstStep>({
    ui: () => mountEveryHotWidget(),
    burst: (store) =>
      buildHotFieldBurst(store, [...HOT_TELEMETRY_FIELDS], BURST_FRAMES),
    applyFrame: (store, step) => step(store),
    afterMount: (container) => {
      countingObserver.observe(container, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    },
    afterBurst: () => {
      // Records already queued but not yet delivered still belong to the burst.
      mutationCount += countingObserver.takeRecords().length;
      countingObserver.disconnect();
    },
  });

  const totalWakeUps = Object.values(report.wakeUps).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    wakeUps: totalWakeUps,
    domMutations: mutationCount,
  };
};

describe('overlay cost', () => {
  it('keeps one second of telemetry inside the overlay budget', async () => {
    const cost = await measureOverlayCost();

    // Printed whether it passes or not: the point of the file is the trend, and
    // a run that only speaks up on failure records nothing to compare against.
    console.log(
      `overlay cost over ${BURST_FRAMES} frames: ${cost.wakeUps} wake-ups, ` +
        `${cost.domMutations} DOM mutations`
    );

    expect(cost.wakeUps).toBeLessThanOrEqual(OVERLAY_BUDGET.wakeUps);
    expect(cost.domMutations).toBeLessThanOrEqual(OVERLAY_BUDGET.domMutations);
  });
});
