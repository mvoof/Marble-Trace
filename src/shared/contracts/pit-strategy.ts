/**
 * Fixed rather than free: the keys are pressed with a wheel-mounted button on
 * the way into the pits, and the useful steps are "a splash", "a stint" and the
 * couple in between, not an arbitrary figure typed in the settings.
 */
export const FUEL_ADJUST_STEPS = [1, 5, 10, 15, 20] as const;

export type FuelAdjustStep = (typeof FUEL_ADJUST_STEPS)[number];

/**
 * The tire pressure steps, offered in the unit the driver reads. The step is
 * stored in kPa — the unit the sim takes — so switching units keeps its size.
 */
export const PRESSURE_ADJUST_STEPS_KPA = [1, 2, 3, 5] as const;
export const PRESSURE_ADJUST_STEPS_PSI = [0.25, 0.5, 1] as const;
export const KPA_PER_PSI = 6.894757;
export const DEFAULT_PRESSURE_ADJUST_STEP_KPA = 1;

/**
 * The rules the pit order is built by — app-level, because the sim has one car
 * and one tank: two pit boxes on two screens cannot hold different ones. Kept
 * in `appSettings` and mirrored to the overlays and remote screens as one value.
 */
export interface PitStrategy {
  /** Auto mode orders the calculated fuel on pit entry. Auto mode as a whole is
   *  on whenever this or `pitAutoTires` is — there is no separate master switch. */
  pitAutoFuel: boolean;
  /** Auto mode orders the corners worn past `pitAutoTireWearThreshold`. */
  pitAutoTires: boolean;
  /** Remaining tread, in percent, at or below which auto mode orders a corner.
   *  Measured on the most worn of the three points across the tread. */
  pitAutoTireWearThreshold: number;
  /** One press of the fuel up / down keys, in the unit the driver reads —
   *  liters on metric, gallons on imperial. */
  pitFuelAdjustStep: FuelAdjustStep;
  /** One press of the tire pressure keys and buttons, in kPa whatever the
   *  unit on display. */
  pitPressureAdjustStep: number;
}
