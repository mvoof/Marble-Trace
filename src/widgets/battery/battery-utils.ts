/** What the MGU-K is doing right now, from the sign of its power. */
export type MguPowerState = 'deploy' | 'regen' | 'idle';

/**
 * Below this the car is coasting and the sign of `power_mgu_k` is noise. A
 * state that flips between DEPLOY and REGEN on the straight is worse than no
 * state at all, so the dead band is wide enough to survive the crossing.
 */
export const MGU_POWER_DEAD_BAND_W = 1_000;

/** Charge below this is amber, and below the critical mark it is red. */
export const CHARGE_LOW_PCT = 0.5;
export const CHARGE_CRITICAL_PCT = 0.15;

/**
 * The MGU-K deploy modes, indexed by the raw `dcMGUKDeployMode` value.
 *
 * Measured in car against the in-car adjustments box, not taken from the SDK:
 * it documents the field as a plain number with no value table. There is no
 * "off" position — an earlier guess carried one, and it shifted every label by
 * a place, so Attack lit the Qual segment.
 */
export const DEPLOY_MODES = ['QUAL', 'ATK', 'BAL', 'BUILD'] as const;

export type DeployMode = (typeof DEPLOY_MODES)[number];

/** Which band the charge falls in — the bar and its divider share the colour. */
export type ChargeLevel = 'full' | 'low' | 'critical';

export const chargeLevel = (fraction: number): ChargeLevel => {
  if (fraction < CHARGE_CRITICAL_PCT) {
    return 'critical';
  }

  if (fraction < CHARGE_LOW_PCT) {
    return 'low';
  }

  return 'full';
};

/**
 * What the bar is divided into before it has been measured.
 *
 * The real count comes from the bar's own width (`useChargeCellCount`), since a
 * cell is a square block and a wider widget should gain divisions rather than
 * stretch the ones it has. This is only what the first frame draws.
 */
export const FALLBACK_CHARGE_BAR_CELLS = 14;

/** How many cells are lit at this charge. A part-full cell counts as lit. */
export const litChargeCells = (fraction: number, cells: number): number => {
  const clamped = Math.min(Math.max(fraction, 0), 1);

  return Math.ceil(clamped * cells);
};

export const mguPowerState = (watts: number | null): MguPowerState => {
  if (watts === null || Math.abs(watts) < MGU_POWER_DEAD_BAND_W) {
    return 'idle';
  }

  return watts > 0 ? 'deploy' : 'regen';
};

/**
 * Watts to kilowatts, padded to a fixed slot. The sign is always drawn and the
 * magnitude always three characters wide, so the readout never re-centres as
 * the car swings between harvesting and deploying.
 */
export const formatMguPowerKw = (watts: number | null): string => {
  if (watts === null) {
    return '····';
  }

  const kw = Math.round(watts / 1000);
  const sign = kw < 0 ? '−' : '+';

  return `${sign}${Math.abs(kw).toString().padStart(3, ' ')}`;
};

/** Charge as a whole percent, padded so 9% and 90% occupy the same width. */
export const formatChargePct = (fraction: number | null): string => {
  if (fraction === null) {
    return '··';
  }

  const pct = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);

  return pct.toString().padStart(2, ' ');
};

/** Joules to megajoules — what the per-lap deploy counter is read in. */
export const formatLapDeployMj = (joules: number | null): string => {
  if (joules === null) {
    return '·.··';
  }

  return (joules / 1_000_000).toFixed(2);
};

/**
 * The selector position, or null when the value is not one.
 *
 * This only catches a value outside the four modes — a car using the field for
 * something else. It does NOT catch a car that parks the field on a valid mode
 * and never moves it, which is what the prototypes do: the 499P reports a
 * constant 3, a real index, so the strip draws with Build lit. Telling that
 * apart needs the value watched over time rather than read from one frame.
 */
export const deployModeIndex = (raw: number | null): number | null => {
  if (raw === null) {
    return null;
  }

  const index = Math.round(raw);

  return index >= 0 && index < DEPLOY_MODES.length ? index : null;
};
