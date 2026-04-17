import type { CarIdxFrame, DriverInfoData } from '../../../types/bindings';
import {
  parseClassColor,
  formatClassShortName,
} from '../../../utils/class-color';
import type { RelativeEntry } from './types';

export const TRACK_SURFACE_IN_PIT_STALL = 1;
export const TRACK_SURFACE_ON_TRACK = 3;
export const TREND_SAMPLE_INTERVAL_MS = 2000;

export const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

export const computeRelativeEntries = (
  carIdx: CarIdxFrame | null,
  driverInfo: DriverInfoData | null
): RelativeEntry[] => {
  const drivers = driverInfo?.Drivers ?? [];
  if (!carIdx || drivers.length === 0) return [];

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const playerLapDistPct =
    playerCarIdx >= 0 ? (carIdx.car_idx_lap_dist_pct[playerCarIdx] ?? 0) : 0;

  const relativeDiff = (other: number): number => {
    let diff = other - playerLapDistPct;
    if (diff < -0.5) diff += 1;
    if (diff > 0.5) diff -= 1;
    return diff;
  };

  return drivers
    .filter((d) => {
      const idx = d.CarIdx;
      if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
      if (idx >= carIdx.car_idx_position.length) return false;
      if (idx === playerCarIdx) return true;
      const pos = carIdx.car_idx_position[idx] ?? 0;
      const lapDistPct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
      if (pos > 0) return true;
      if (lapDistPct >= 0) return true;
      return false;
    })
    .map((d): RelativeEntry => {
      const idx = d.CarIdx;
      const rawClass =
        d.CarClassShortName ||
        (d.CarClassRelSpeed != null ? `Class ${d.CarClassRelSpeed}` : 'Class');
      const classLabel = formatClassShortName(
        rawClass,
        d.CarScreenName,
        d.CarClassID ?? undefined
      );

      return {
        carIdx: idx,
        userName: d.UserName,
        carNumber: d.CarNumber ?? '',
        carClassId: d.CarClassID ?? -1,
        carClass: classLabel,
        carClassShortName: classLabel,
        carClassColor: parseClassColor(d.CarClassColor),
        position: carIdx.car_idx_position[idx] ?? 0,
        lap: carIdx.car_idx_lap?.[idx] ?? 0,
        lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
        f2Time: carIdx.car_idx_f2_time?.[idx] ?? 0,
        trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
        iRating: d.IRating ?? 0,
        licString: d.LicString ?? 'R 0.00',
        isPlayer: idx === playerCarIdx,
        onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
      };
    })
    .sort((a, b) => relativeDiff(b.lapDistPct) - relativeDiff(a.lapDistPct));
};
