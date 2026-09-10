import {
  displayDistanceToMeters,
  metersToDisplayDistance,
} from '@utils/telemetry-format';

// Meters are stored to the centimeter — enough for a foot slider to land back
// on its own notch, short of writing a float nobody can read into the file.
const CM_PER_M = 100;

/**
 * A distance slider read in the driver's own units over a setting stored in
 * meters. Shared by the two pit panels, which both offer one.
 */
interface DistanceSliderScale {
  min: number;
  max: number;
  step: number;
  unit: string;
  toDisplay: (meters: number) => number;
  toMeters: (value: number) => number;
}

export const distanceScale = (
  isImperial: boolean,
  bounds: { minM: number; maxM: number; stepM: number; stepFt: number }
): DistanceSliderScale => {
  const system = isImperial ? 'imperial' : 'metric';
  const toDisplay = (meters: number) =>
    Math.round(metersToDisplayDistance(meters, system));

  return {
    min: toDisplay(bounds.minM),
    max: toDisplay(bounds.maxM),
    step: isImperial ? bounds.stepFt : bounds.stepM,
    unit: isImperial ? 'ft' : 'm',
    toDisplay,
    // Feet are kept exact rather than rounded to whole meters: 100 ft is
    // 30.48 m, and a 30 m round trip reads back as 98 ft — the thumb would
    // slide off the notch the driver just dropped it on. Meters are already
    // whole, so they stay whole.
    toMeters: (value: number) =>
      isImperial
        ? Math.round(displayDistanceToMeters(value, system) * CM_PER_M) /
          CM_PER_M
        : Math.round(value),
  };
};
