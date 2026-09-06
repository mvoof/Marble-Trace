import { describe, expect, it } from 'vitest';
import { createElement } from 'react';

import { WIDGET_BY_ID } from '@store/widget-catalog';
import { componentForWidget } from '@ui/widgets/registry';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import { HOT_WIDGET_IDS, hotFieldsOf } from './hot-fields';
import { buildHotFieldBurst, type BurstStep } from './telemetry-bursts';
import { measureRenderBudget } from './render-budget';
import { BURST_FRAMES } from './widget-budget';

/**
 * Separates a component that wakes because its own field changed from one that
 * wakes because an unrelated field of the same frame did — the two need
 * different fixes, and only the second is an argument for per-field
 * observables.
 *
 * The separator is what the burst puts on screen: the markup is hashed after
 * every frame, and a widget whose markup takes one value across a burst that
 * woke it hundreds of times rendered nothing it was woken for.
 *
 * What follows from these numbers is
 * `docs/adr/0001-per-field-telemetry-observables.md`. This file is the method,
 * kept runnable and pinned so the record cannot rot unnoticed.
 */

/** Widgets that paint to a canvas: their output is not in the markup at all. */
const CANVAS_ONLY_WIDGET_IDS = new Set(['g-meter']);

/**
 * What the burst drew, per widget, as a class rather than as a count.
 *
 * `same` means the widget drew all but nothing the same thing for the whole
 * burst; `every-frame` means each frame showed something new; `partial` is a
 * value the burst moves faster than the widget's own formatting resolves.
 *
 * Classes, not counts, because a count is not stable to the frame: a widget
 * with a fade-out timer can land one rendering either side of the boundary
 * between runs, and the record's argument does not turn on that.
 *
 * A canvas inside an otherwise-DOM widget counts as no change, which is why
 * `proximity-radar` and `radar-bar` read `same` — see the record for what that
 * costs the classification.
 */
type RenderingClass = 'same' | 'partial' | 'every-frame';

const RENDERING_CLASSES: Record<string, RenderingClass> = {
  'close-battle': 'same',
  coach: 'partial',
  'engine-panel': 'same',
  'input-trace': 'partial',
  'invisible-dash': 'every-frame',
  'pit-service': 'same',
  'proximity-radar': 'same',
  'race-dash': 'every-frame',
  'radar-bar': 'same',
  relative: 'same',
  'relative-map': 'same',
  'rpm-lights': 'partial',
  'sector-matrix': 'partial',
  standings: 'same',
  timer: 'same',
  'track-map': 'every-frame',
  weather: 'every-frame',
};

/** Below this share of the burst, a widget drew the same thing throughout. */
const SAME_RENDERING_SHARE = 0.1;

const classifyRenderings = (distinct: number): RenderingClass => {
  if (distinct >= BURST_FRAMES) {
    return 'every-frame';
  }

  if (distinct <= BURST_FRAMES * SAME_RENDERING_SHARE) {
    return 'same';
  }

  return 'partial';
};

const measureDistinctRenderings = async (widgetId: string): Promise<number> => {
  const manifest = WIDGET_BY_ID.get(widgetId);
  const component = componentForWidget(widgetId);

  if (!manifest || !component) {
    throw new Error(`Wake-up classification: '${widgetId}' does not mount.`);
  }

  const markupPerFrame: string[] = [];

  await measureRenderBudget<BurstStep>({
    ui: () =>
      createElement(
        WidgetIdContext.Provider,
        { value: widgetId },
        createElement(component)
      ),
    burst: (store) =>
      buildHotFieldBurst(store, hotFieldsOf(manifest), BURST_FRAMES),
    applyFrame: (store, step) => step(store),
    afterFrame: (container) => {
      markupPerFrame.push(container.innerHTML);
    },
  });

  return new Set(markupPerFrame).size;
};

describe('wake-up classification', () => {
  it('classifies every hot widget the way the record was written from', async () => {
    const measured: Record<string, RenderingClass> = {};

    for (const widgetId of HOT_WIDGET_IDS) {
      if (CANVAS_ONLY_WIDGET_IDS.has(widgetId)) {
        continue;
      }

      measured[widgetId] = classifyRenderings(
        await measureDistinctRenderings(widgetId)
      );
    }

    expect(measured).toEqual(RENDERING_CLASSES);
  });
});
