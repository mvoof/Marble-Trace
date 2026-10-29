/**
 * A reply value read straight from the sim by its own variable name —
 * `{sim.PlayerCarMyIncidentCount}`, `{sim.Speed.kmh}` — and the variables a
 * question's reply can pick from.
 */

import {
  VOICE_SIM_SCALE_KMH,
  VOICE_SIM_SCALE_PERCENT,
  VOICE_SIM_SCALE_TENTHS,
  VOICE_SIM_VALUE_PREFIX,
} from '@shared/contracts/generated/backend-constants';
import type { RawVarMeta } from '@shared/contracts/generated/bindings';
import overlayVariables from '@shared/contracts/generated/iracing-variables.json';

export type SimScale = 'whole' | 'tenths' | 'kmh' | 'percent';

export const SIM_SCALES: SimScale[] = ['whole', 'tenths', 'kmh', 'percent'];

const SCALE_SUFFIXES: Record<SimScale, string | null> = {
  whole: null,
  tenths: VOICE_SIM_SCALE_TENTHS,
  kmh: VOICE_SIM_SCALE_KMH,
  percent: VOICE_SIM_SCALE_PERCENT,
};
const SPEED_UNITS = ['m/s'];
const SHARE_UNITS = ['%', 'Percentage'];
const SECOND_UNITS = ['s', 'Second'];

/** A variable the overlay reads, and the value the engineer already makes of it. */
export interface OverlayVariable extends RawVarMeta {
  /** `fuel` for `FuelLevel`: the reply may say `{fuel}` instead. */
  ready: string | null;
}

/** What a question's reply may read from the sim: the variables the overlay reads, numbers all. */
export const OVERLAY_VARIABLES: OverlayVariable[] = overlayVariables;

/** The reply value naming a variable read this way. */
export const simValueName = (variable: string, scale: SimScale): string => {
  const suffix = SCALE_SUFFIXES[scale];

  return suffix === null
    ? `${VOICE_SIM_VALUE_PREFIX}${variable}`
    : `${VOICE_SIM_VALUE_PREFIX}${variable}.${suffix}`;
};

export const isSimValueName = (name: string): boolean =>
  name.startsWith(VOICE_SIM_VALUE_PREFIX);

/** How a variable is most likely meant to be said, from its unit. */
export const defaultSimScale = (variable: RawVarMeta): SimScale => {
  if (SPEED_UNITS.includes(variable.unit)) {
    return 'kmh';
  }

  if (SHARE_UNITS.includes(variable.unit)) {
    return 'percent';
  }

  if (SECOND_UNITS.includes(variable.unit)) {
    return 'tenths';
  }

  return 'whole';
};

/** Variables whose name or description holds every word of the query; names first. */
export const searchVariables = <Variable extends RawVarMeta>(
  variables: Variable[],
  query: string
): Variable[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = variables.filter((variable) => {
    const haystack = `${variable.name} ${variable.desc}`.toLowerCase();

    return words.every((word) => haystack.includes(word));
  });
  const byName = (variable: Variable) =>
    words.every((word) => variable.name.toLowerCase().includes(word));

  return [
    ...matches.filter(byName),
    ...matches.filter((variable) => !byName(variable)),
  ];
};
