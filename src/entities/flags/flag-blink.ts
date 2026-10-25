import type { BlinkCycle } from '@shared/hooks/useBlink';

/**
 * How a yellow or a red flashes on the LED flag widget: lit and dark 400 ms
 * each, every LED switching together.
 */
export const FLAG_BLINK: BlinkCycle = { stepMs: 400, steps: 2 };
