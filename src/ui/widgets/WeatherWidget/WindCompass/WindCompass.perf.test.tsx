import { describe, expect, it } from 'vitest';

import {
  assertRenderBudgets,
  measureRenderBudget,
  type RenderBudget,
} from '@/perf/render-budget';
import type { CarDynamicsFrame } from '@/types/bindings';
import { WindCompass } from './WindCompass';

/**
 * The compass ring is the canonical case for the rendering rule: twelve ticks
 * and four labels that never change, rotating with a heading that changes every
 * frame. See `docs/rendering.md`.
 *
 * | component    | budget | state |
 * | ------------ | ------ | ----- |
 * | RotatingRing | 0      | ok    |
 * | RingGeometry | 0      | ok    |
 * | WindCompass  | 0      | ok    |
 * | WindArrow    | 1      | ok    |
 *
 * `RotatingRing` sends the heading to the DOM through `useReactiveDomWrite`, so
 * a burst of headings wakes React not once; its geometry is created by
 * `WindCompass`, which the heading does not re-render either. `WindArrow` sends
 * its bearing the same way and only re-renders for the wind's own speed.
 */
const BUDGETS: Record<string, RenderBudget> = {
  RotatingRing: { budget: 0 },
  RingGeometry: { budget: 0 },
  WindCompass: { budget: 0 },
  WindArrow: { budget: 1 },
};

const BURST_FRAMES = 60;

const RADIANS_TO_DEGREES = 180 / Math.PI;

/** A full rotation across the burst, so the wrap from 359° to 0° is included. */
const buildHeadingBurst = (base: CarDynamicsFrame): CarDynamicsFrame[] =>
  Array.from({ length: BURST_FRAMES }, (_unused, frameIndex) => ({
    ...base,
    yaw: (frameIndex / BURST_FRAMES) * Math.PI * 2,
  }));

const LAST_FRAME_YAW = ((BURST_FRAMES - 1) / BURST_FRAMES) * Math.PI * 2;

const yawPropertyOf = (group: SVGGElement): string =>
  group.style.getPropertyValue('--compass-yaw');

const asDegrees = (yawRad: number): string =>
  `${-yawRad * RADIANS_TO_DEGREES}deg`;

const findRotatingGroup = (container: HTMLElement): SVGGElement => {
  const group = container.querySelector('svg > g');

  if (!(group instanceof SVGGElement)) {
    throw new Error('The compass ring was not rendered.');
  }

  return group;
};

describe('WindCompass render budget', () => {
  it('does not wake React while the heading changes every frame', async () => {
    let seededYawRad = 0;
    let yawAtFirstPaint: string | null = null;
    let writtenYaw: string | null = null;

    const report = await measureRenderBudget<CarDynamicsFrame>({
      ui: () => <WindCompass />,
      burst: (store) => buildHeadingBurst(store.player.carDynamics!),
      applyFrame: (store, frame) => store.player.updateCarDynamics(frame),
      seed: (store) => {
        seededYawRad = store.player.carDynamics?.yaw ?? 0;
      },
      afterMount: (container) => {
        yawAtFirstPaint = yawPropertyOf(findRotatingGroup(container));
      },
      afterBurst: (container) => {
        writtenYaw =
          findRotatingGroup(container).style.getPropertyValue('--compass-yaw');
      },
    });

    expect(report.frames).toBe(BURST_FRAMES);

    // The first write is synchronous, so the ring is never painted pointing at
    // the stylesheet's fallback before jumping to the real heading.
    expect(yawAtFirstPaint).toBe(asDegrees(seededYawRad));
    assertRenderBudgets(report, BUDGETS);

    // The other half of the bypass's contract: React was not woken *and* the
    // value did reach the DOM, at the last heading of the burst.
    expect(writtenYaw).toBe(asDegrees(LAST_FRAME_YAW));
  });
});
