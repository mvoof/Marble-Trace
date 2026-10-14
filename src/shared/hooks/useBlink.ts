import { useLayoutEffect, useState, type RefCallback } from 'react';

/**
 * The attribute a blink writes its current step to. Stylesheets select on it:
 * step `0` is the element's own look, every other step is a rule of its own
 * (`.zoneLayerBlink[data-blink-step='1'] { opacity: 0.42 }`).
 */
export const BLINK_STEP_ATTRIBUTE = 'data-blink-step';

/** Each step lasts `stepMs`; the cycle runs `steps` of them and starts over. */
export interface BlinkCycle {
  stepMs: number;
  steps: number;
}

export interface BlinkHandle {
  /** The element the step is written on; null detaches it. */
  attach: (element: Element | null) => void;
  /** Starts a cycle, or with null stops it and removes the attribute. */
  run: (cycle: BlinkCycle | null) => void;
}

// A timer can fire a hair before the boundary it was set for; landing just
// after it keeps the step from being read twice.
const BOUNDARY_SLACK_MS = 1;

const sameCycle = (
  first: BlinkCycle | null,
  second: BlinkCycle | null
): boolean =>
  first === second ||
  (first !== null &&
    second !== null &&
    first.stepMs === second.stepMs &&
    first.steps === second.steps);

/**
 * A blink driven by a timer instead of a CSS `animation`. A running animation,
 * even a `steps()` one, makes the browser build a frame on every display
 * refresh, so a blinking light kept the overlay — and the game's GPU — redrawing
 * at the monitor's rate (ADR-0009). This writes the DOM only when the step
 * changes: a 2 Hz blink costs four frames a second.
 *
 * The step is read off the page clock, not counted from the start, so every
 * blink of the same cycle on screen switches together.
 */
export const createBlink = (): BlinkHandle => {
  let element: Element | null = null;
  let cycle: BlinkCycle | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let step: string | null = null;

  const write = () => {
    if (!element) {
      return;
    }

    const written = element.getAttribute(BLINK_STEP_ATTRIBUTE);

    if (written === step) {
      return;
    }

    if (step === null) {
      element.removeAttribute(BLINK_STEP_ATTRIBUTE);
    } else {
      element.setAttribute(BLINK_STEP_ATTRIBUTE, step);
    }
  };

  const tick = () => {
    if (!cycle) {
      return;
    }

    const now = performance.now();

    step = String(Math.floor(now / cycle.stepMs) % cycle.steps);
    write();
    timer = setTimeout(
      tick,
      cycle.stepMs - (now % cycle.stepMs) + BOUNDARY_SLACK_MS
    );
  };

  return {
    attach: (next) => {
      if (next === element) {
        return;
      }

      element?.removeAttribute(BLINK_STEP_ATTRIBUTE);
      element = next;
      write();
    },
    run: (next) => {
      if (sameCycle(next, cycle)) {
        return;
      }

      clearTimeout(timer);
      cycle = next;

      if (next) {
        tick();
      } else {
        step = null;
        write();
      }
    },
  };
};

/**
 * A blink handle that stops with the component. For an element whose blink is
 * decided inside a reactive DOM write: call `attach` and `run` from there.
 */
export const useBlinkHandle = (): BlinkHandle => {
  const [blink] = useState(createBlink);

  useLayoutEffect(() => () => blink.run(null), [blink]);

  return blink;
};

/**
 * Blinks the element the returned ref is attached to while `cycle` is set.
 * Pass a constant cycle, or null to stop.
 */
export const useBlink = <ElementType extends Element>(
  cycle: BlinkCycle | null
): RefCallback<ElementType> => {
  const blink = useBlinkHandle();

  useLayoutEffect(() => {
    blink.run(cycle);
  });

  return blink.attach;
};
