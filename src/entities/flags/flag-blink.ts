import type { BlinkCycle } from '@shared/hooks/useBlink';

/**
 * How a yellow or a red flashes on the flag widgets that do not animate the
 * flag itself: lit and dark 400 ms each, every widget switching together.
 */
export const FLAG_BLINK: BlinkCycle = { stepMs: 400, steps: 2 };
