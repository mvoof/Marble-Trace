import { useLayoutEffect, type RefObject } from 'react';
import type { FlagType } from '@/types';

/** Flags whose active state blinks at all — the rest render statically. */
const BLINKING_FLAGS: ReadonlySet<FlagType> = new Set([
  'yellow',
  'blue',
  'checkered',
  'debris',
  'meatball',
  'black',
  'sc',
  'dq',
  'red',
  'white',
]);

/**
 * Flips every half-cycle, matching the retired `steps(1) 1s infinite`
 * keyframes' 0%/50% split.
 */
const BLINK_HALF_CYCLE_MS = 500;

/** Full period of the white flag's breathing pulse, matching the retired `ledWhiteBreathing 2s` keyframe. */
const BREATHE_PERIOD_MS = 2000;

const FULL_TURN_RADIANS = Math.PI * 2;

/**
 * Drives every diode's blink from one shared timer instead of one CSS
 * `animation` per diode. A large board holds 500+ diodes; running that many
 * independent CSS Animation instances made `led-flags` the single most
 * expensive widget in the overlay's own FPS diagnostics (GPU usage well
 * above every other widget — see the diagnostics CSV from 2026-09-08).
 *
 * This writes two custom properties, `--phase-a` and its complement
 * `--phase-b`, onto the board element. Every diode's `background-color` in
 * LedMatrix.module.scss reads one of them through `color-mix()` — a static
 * formula, no `animation` of its own — so one DOM write per tick reaches
 * however many diodes are on screen instead of each running its own
 * animation timeline.
 */
export const useLedBlinkClock = (
  boardRef: RefObject<HTMLDivElement | null>,
  flag: FlagType,
  animate: boolean,
  isOff: boolean
): void => {
  useLayoutEffect(() => {
    const board = boardRef.current;

    if (!board || !animate || isOff || !BLINKING_FLAGS.has(flag)) {
      return;
    }

    if (flag === 'white') {
      const start = performance.now();
      let rafId = 0;

      const tick = (now: number) => {
        const t = ((now - start) % BREATHE_PERIOD_MS) / BREATHE_PERIOD_MS;
        // Half-cosine ease, mirroring the retired `ease-in-out` keyframe.
        const eased = (1 - Math.cos(t * FULL_TURN_RADIANS)) / 2;

        board.style.setProperty('--phase-a', eased.toString());
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(rafId);
    }

    let phaseAOn = true;

    const flip = () => {
      board.style.setProperty('--phase-a', phaseAOn ? '1' : '0');
      board.style.setProperty('--phase-b', phaseAOn ? '0' : '1');
      phaseAOn = !phaseAOn;
    };

    flip();
    const intervalId = setInterval(flip, BLINK_HALF_CYCLE_MS);

    return () => clearInterval(intervalId);
  }, [boardRef, flag, animate, isOff]);
};
