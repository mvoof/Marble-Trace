import type { UnitSystem } from '../store/units.store';

const MPS_TO_KMH = 3.6;
const MPS_TO_MPH = 2.23694;
const LITERS_TO_GAL = 0.264172;
const METERS_TO_FEET = 3.28084;

export function formatSpeed(mps: number, system: UnitSystem): string {
  const factor = system === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  return Math.round(mps * factor).toString();
}

export function speedUnit(system: UnitSystem): string {
  return system === 'metric' ? 'KM/H' : 'MPH';
}

export function formatTemp(celsius: number | null, system: UnitSystem): string {
  if (celsius === null) return '\u2014';

  if (system === 'imperial') {
    return (celsius * 1.8 + 32).toFixed(1);
  }

  return celsius.toFixed(1);
}

export function tempUnit(system: UnitSystem): string {
  return system === 'metric' ? '\u00B0C' : '\u00B0F';
}

export function formatFuel(liters: number, system: UnitSystem): string {
  if (system === 'imperial') {
    return (liters * LITERS_TO_GAL).toFixed(2);
  }

  return liters.toFixed(2);
}

export function fuelUnit(system: UnitSystem): string {
  return system === 'metric' ? 'L' : 'GAL';
}

export function formatDistance(meters: number, system: UnitSystem): string {
  if (system === 'imperial') {
    return (meters * METERS_TO_FEET).toFixed(1);
  }

  return meters.toFixed(1);
}

export function distanceUnit(system: UnitSystem): string {
  return system === 'metric' ? 'м' : 'ft';
}

export function formatGear(gear: number): string {
  if (gear === 0) return 'N';
  if (gear < 0) return 'R';
  return gear.toString();
}

export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '\u2014';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins > 0) {
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  return secs.toFixed(3);
}

export function formatSessionTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '\u2014';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatRpm(rpm: number): string {
  return Math.round(rpm).toString();
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return '\u2014';
  return `${Math.round(fraction * 100)}%`;
}

export function clampNormalized(value: number): number {
  return Math.max(0, Math.min(1, value));
}
