import { createElement } from 'react';
import { runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';

import { measureRenderBudget } from '@/perf/render-budget';
import type { ProximityFrame } from '@/types/bindings';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import type { RootStore } from '@store/root-store';
import { RadarBar } from './RadarBar';

/**
 * Not a budget — a witness. The bar draws nothing until the spotter calls a car
 * alongside, so its pill is mounted several commits after the component is, and
 * `useReactiveDomWrite` has to pick the element up when it appears rather than
 * when the component does. It once did not, and the bar rendered as an empty
 * track for the whole session. See `useReactiveDomWrite.perf.test.tsx` for the
 * rule itself.
 *
 * A browser test for the same reason every test beside it is one: what is
 * asserted is a real style write.
 */

const PILL_TOP_PROPERTY = '--radar-pill-top';
const PILL_HEIGHT_PROPERTY = '--radar-pill-height';

const RIGHT_DISTANCE_M = 1.5;

const proximityFrame = (isAlongside: boolean): ProximityFrame => ({
  nearbyCars: [],
  radarDistances: {
    frontDist: 8,
    rearDist: 8,
    leftDist: null,
    rightDist: isAlongside ? RIGHT_DISTANCE_M : null,
  },
  spotterLeft: false,
  spotterRight: isAlongside,
});

const silenceTheSpotter = (store: RootStore) => {
  runInAction(() => {
    store.backendComputed.updateProximity(proximityFrame(false));
    store.appSettings.dragMode = false;
  });
};

const findPill = (container: HTMLElement): HTMLElement | null =>
  container.querySelector<HTMLElement>('[class*="pill"]');

describe('RadarBar', () => {
  it('fills its pill when the spotter calls a car alongside', async () => {
    let pillAtFirstPaint: HTMLElement | null = null;

    await measureRenderBudget<ProximityFrame>({
      ui: () =>
        createElement(
          WidgetIdContext.Provider,
          { value: 'radar-bar' },
          createElement(RadarBar, { side: 'right' })
        ),
      seed: silenceTheSpotter,
      burst: () => [proximityFrame(true)],
      applyFrame: (store, frame) => {
        store.backendComputed.updateProximity(frame);
      },
      afterMount: (container) => {
        pillAtFirstPaint = findPill(container);
      },
      afterBurst: (container) => {
        const pill = findPill(container);

        expect(pill).not.toBeNull();
        expect(pill!.style.getPropertyValue(PILL_TOP_PROPERTY)).not.toBe('');
        expect(pill!.style.getPropertyValue(PILL_HEIGHT_PROPERTY)).not.toBe('');
      },
    });

    expect(pillAtFirstPaint).toBeNull();
  });
});
