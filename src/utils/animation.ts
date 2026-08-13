/**
 * Timings shared between a UI animation and a store that has to know when it
 * ends. The store cannot import the hook that plays the animation — that would
 * point the store layer at the UI — so the duration is declared here and both
 * sides read it.
 */

/** FLIP row-move animation in Standings and Relative. */
export const MOVE_DURATION_MS = 360;
