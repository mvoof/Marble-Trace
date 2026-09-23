import type { BattleSlot } from './wheel-to-wheel.widget';

// Overlay text is English in every locale, like every other widget's.
export const SLOT_ROLE: Record<BattleSlot, string> = {
  player: 'You',
  ahead: 'Ahead',
  behind: 'Behind',
};
