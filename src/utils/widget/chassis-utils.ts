import type { CornerData, CornerPosition } from '@widgets/ChassisWidget/types';
import type { ChassisFrame } from '@/types/bindings';
import type { UnitSystem } from '@/types';

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
const getTempColor = (tempC: number | null | undefined): string => {
  if (tempC == null) return '#475569';
  if (tempC < 75) return COLOR_INFO;
  if (tempC <= 105) return COLOR_OK;
  if (tempC <= 125) return COLOR_WARNING;

  return COLOR_DANGER;
};

// Brake disc temperature thresholds (°C)
const getBrakeColor = (tempC: number | null | undefined): string => {
  if (tempC == null || tempC < 200) return '#475569';
  if (tempC < 400) return COLOR_OK;
  if (tempC < 600) return COLOR_WARNING;

  return COLOR_DANGER;
};

export const computeAxleDiff = (
  a: number | null | undefined,
  b: number | null | undefined
): number | null => {
  if (a == null || b == null) return null;

  return a - b;
};

export const buildCornerData = (
  position: CornerPosition,
  frame: ChassisFrame | null | undefined,
  system: UnitSystem
): CornerData => {
  const rideHeightM = frame?.[`${position}_ride_height`];
  const shockDeflM = frame?.[`${position}_shock_defl`];
  const tempCL = frame?.[`${position}_temp_cl`];
  const tempCM = frame?.[`${position}_temp_cm`];
  const tempCR = frame?.[`${position}_temp_cr`];
  const pressureKpa = frame?.[`${position}_pressure`];
  const wearL = frame?.[`${position}_wear_l`];
  const wearM = frame?.[`${position}_wear_m`];
  const wearR = frame?.[`${position}_wear_r`];
  const brakeTempC = frame?.[`${position}_brake_temp`];

  return {
    rideHeight: rideHeightM != null ? convertLength(rideHeightM, system) : null,
    shockDefl: shockDeflM != null ? convertLength(shockDeflM, system) : null,
    tempL: tempCL != null ? convertTemp(tempCL, system) : null,
    tempM: tempCM != null ? convertTemp(tempCM, system) : null,
    tempR: tempCR != null ? convertTemp(tempCR, system) : null,
    tempColorL: getTempColor(tempCL),
    tempColorM: getTempColor(tempCM),
    tempColorR: getTempColor(tempCR),
    pressure: pressureKpa != null ? convertPressure(pressureKpa, system) : null,
    pressureUnit: system === 'metric' ? 'kPa' : 'PSI',
    wearL: wearL ?? null,
    wearM: wearM ?? null,
    wearR: wearR ?? null,
    brakeTemp: brakeTempC != null ? convertTemp(brakeTempC, system) : null,
    brakeTempColor: getBrakeColor(brakeTempC),
    isPunctured:
      pressureKpa != null &&
      pressureKpa > 0 &&
      pressureKpa < PUNCTURE_THRESHOLD_KPA,
    isBrakeOverheated:
      brakeTempC != null && brakeTempC > BRAKE_OVERHEAT_THRESHOLD_C,
  };
};
