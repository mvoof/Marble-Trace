import type { CarIdxFrame, DriverInfoData } from '../../../types/bindings';
import { parseClassColor } from '../../../utils/class-color';
import type { DriverEntry } from './types';

export const TRACK_SURFACE_OFF_TRACK = 0;
export const TRACK_SURFACE_IN_PIT_STALL = 1;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

export const NO_CLASS_LABEL = 'No Class';
export const NO_CLASS_COLOR = '#888888';

const CLASS_CATEGORY_REGEX =
  /\b(GTP|LMP1|LMP2|LMP3|GTE|GT3|GT4|GT2|TCR|CUP|MX-?5)\b/i;

const MAX_BADGE_LABEL_LENGTH = 6;

/**
 * Build a compact badge label from CarScreenNameShort.
 * Prefers a recognised racing category tag (GT3, LMP2, CUP, …); otherwise
 * falls back to the first word, truncated to fit a small badge.
 */
export const shortenClassLabel = (screenNameShort: string): string => {
  if (!screenNameShort) return '—';
  const match = CLASS_CATEGORY_REGEX.exec(screenNameShort);
  if (match) return match[1].toUpperCase();
  const firstWord = screenNameShort.split(/\s+/)[0] ?? screenNameShort;
  return firstWord.length <= MAX_BADGE_LABEL_LENGTH
    ? firstWord
    : firstWord.slice(0, MAX_BADGE_LABEL_LENGTH);
};

export const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

export const formatBrand = (screenName: string): string => {
  if (!screenName) return '';
  return screenName.split(' ')[0] ?? screenName;
};

export const computeStandingsEntries = (
  carIdx: CarIdxFrame | null,
  driverInfo: DriverInfoData | null,
  startPositions: Map<number, { overall: number; class: number }>
): DriverEntry[] => {
  const allDrivers = driverInfo?.Drivers ?? [];
  if (!carIdx || allDrivers.length === 0) return [];

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const driverTires = driverInfo?.DriverTires ?? [];

  return allDrivers
    .filter((driver) => {
      const idx = driver.CarIdx;
      if (driver.CarIsPaceCar === 1 || driver.IsSpectator === 1) return false;
      if (idx >= carIdx.car_idx_position.length) return false;
      if (idx === playerCarIdx) return true;
      const pos = carIdx.car_idx_position[idx] ?? 0;
      const lapDistPct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
      if (pos > 0) return true;
      if (lapDistPct >= 0) return true;
      return false;
    })
    .map((driver): DriverEntry => {
      const idx = driver.CarIdx;
      return {
        carIdx: idx,
        userName: driver.UserName,
        carNumber: driver.CarNumber ?? '',
        carClassId: driver.CarClassID ?? -1,
        carClassShortName: driver.CarClassShortName ?? '',
        carClassColor: driver.CarClassColor
          ? parseClassColor(driver.CarClassColor)
          : NO_CLASS_COLOR,
        carScreenName: driver.CarScreenName ?? '',
        carScreenNameShort: driver.CarScreenNameShort ?? '',
        tireCompound: ((): string => {
          const tireIdx = carIdx.car_idx_tire_compound?.[idx] ?? -1;
          if (tireIdx < 0) return '';
          return (
            driverTires.find((t) => t.TireIndex === tireIdx)
              ?.TireCompoundType ?? ''
          );
        })(),
        position: carIdx.car_idx_position[idx] ?? 0,
        classPosition: carIdx.car_idx_class_position[idx] ?? 0,
        startPosOverall: startPositions.get(idx)?.overall ?? 0,
        startPosClass: startPositions.get(idx)?.class ?? 0,
        lap: carIdx.car_idx_lap?.[idx] ?? 0,
        lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
        lastLapTime: carIdx.car_idx_last_lap_time?.[idx] ?? -1,
        bestLapTime: carIdx.car_idx_best_lap_time?.[idx] ?? -1,
        f2Time: carIdx.car_idx_f2_time?.[idx] ?? 0,
        trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
        iRating: driver.IRating ?? 0,
        licString: driver.LicString ?? 'R 0.00',
        licColor: driver.LicColor ?? '000000',
        incidents: driver.CurDriverIncidentCount ?? 0,
        isPlayer: idx === playerCarIdx,
        onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
      };
    })
    .sort((a, b) => {
      const posA = a.position > 0 ? a.position : a.startPosOverall || 999;
      const posB = b.position > 0 ? b.position : b.startPosOverall || 999;
      return posA - posB;
    });
};
