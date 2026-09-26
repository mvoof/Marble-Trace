import type { BattleSlot } from './wheel-to-wheel.widget';

// Overlay text is English in every locale, like every other widget's.
export const SLOT_ROLE: Record<BattleSlot, string> = {
  player: 'You',
  ahead: 'Ahead',
  behind: 'Behind',
};

/** The class position beside the role; empty until the sim has placed the car. */
export const formatSlotPosition = (position: number | undefined): string =>
  position ? `P${position}` : '';
