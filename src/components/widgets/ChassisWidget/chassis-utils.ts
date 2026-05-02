import type { CornerData } from './types';
import type { ChassisFrame } from '../../../types/bindings';
import type { UnitSystem } from '../../../types/units';

const METERS_TO_MM = 1000;
const METERS_TO_INCHES = 39.3701;
const KPA_TO_PSI = 0.145038;

const PUNCTURE_THRESHOLD_KPA = 50;
const BRAKE_OVERHEAT_THRESHOLD_C = 850;

// Project color palette (matches _variables.scss semantic colors)
const COLOR_INFO = '#3399ff'; // cold
const COLOR_OK = '#00cc44'; // optimal
const COLOR_WARNING = '#ffcc00'; // hot
const COLOR_DANGER = '#ff3333'; // overheating/critical

const convertLength = (meters: number, system: UnitSystem): number =>
  system === 'metric' ? meters * METERS_TO_MM : meters * METERS_TO_INCHES;

const convertTemp = (celsius: number, system: UnitSystem): number =>
  system === 'metric' ? celsius : (celsius * 9) / 5 + 32;

const convertPressure = (kpa: number, system: UnitSystem): number =>
  system === 'metric' ? kpa : kpa * KPA_TO_PSI;

// Tire temperature thresholds (°C)
export const getTempColor = (tempC: number): string => {
  if (tempC < 75) return COLOR_INFO;
  if (tempC <= 105) return COLOR_OK;
  if (tempC <= 125) return COLOR_WARNING;
  return COLOR_DANGER;
};

// Brake disc temperature thresholds (°C)
export const getBrakeColor = (tempC: number): string => {
  if (tempC < 200) return '#475569';
  if (tempC < 400) return COLOR_OK;
  if (tempC < 600) return COLOR_WARNING;
  return COLOR_DANGER;
};

export const computeAxleDiff = (a: number, b: number): number => a - b;

const buildCornerData = (
  rideHeightM: number | null | undefined,
  shockDeflM: number | null | undefined,
  tempCL: number | null | undefined,
  tempCM: number | null | undefined,
  tempCR: number | null | undefined,
  pressureKpa: number | null | undefined,
  wearL: number | null | undefined,
  wearM: number | null | undefined,
  wearR: number | null | undefined,
  brakeTempC: number | null | undefined,
  system: UnitSystem
): CornerData => {
  const rawPressure = pressureKpa ?? 0;
  const rawBrakeTemp = brakeTempC ?? 20;
  const rawTempL = tempCL ?? 20;
  const rawTempM = tempCM ?? 20;
  const rawTempR = tempCR ?? 20;

  return {
    rideHeight: rideHeightM != null ? convertLength(rideHeightM, system) : 0,
    shockDefl: shockDeflM != null ? convertLength(shockDeflM, system) : 0,
    tempL: convertTemp(rawTempL, system),
    tempM: convertTemp(rawTempM, system),
    tempR: convertTemp(rawTempR, system),
    tempColorL: getTempColor(rawTempL),
    tempColorM: getTempColor(rawTempM),
    tempColorR: getTempColor(rawTempR),
    pressure: convertPressure(rawPressure, system),
    pressureUnit: system === 'metric' ? 'kPa' : 'PSI',
    wearL: wearL ?? 1,
    wearM: wearM ?? 1,
    wearR: wearR ?? 1,
    brakeTemp: convertTemp(rawBrakeTemp, system),
    brakeTempColor: getBrakeColor(rawBrakeTemp),
    isPunctured: rawPressure > 0 && rawPressure < PUNCTURE_THRESHOLD_KPA,
    isBrakeOverheated: rawBrakeTemp > BRAKE_OVERHEAT_THRESHOLD_C,
  };
};

export const buildAllCorners = (
  frame: ChassisFrame,
  system: UnitSystem
): { lf: CornerData; rf: CornerData; lr: CornerData; rr: CornerData } => {
  const corners = ['lf', 'rf', 'lr', 'rr'] as const;
  const result = {} as Record<
    (typeof corners)[number],
    ReturnType<typeof buildCornerData>
  >;

  for (const c of corners) {
    result[c] = buildCornerData(
      frame[`${c}_ride_height`],
      frame[`${c}_shock_defl`],
      frame[`${c}_temp_cl`],
      frame[`${c}_temp_cm`],
      frame[`${c}_temp_cr`],
      frame[`${c}_pressure`],
      frame[`${c}_wear_l`],
      frame[`${c}_wear_m`],
      frame[`${c}_wear_r`],
      frame[`${c}_brake_temp`],
      system
    );
  }

  return result;
};
