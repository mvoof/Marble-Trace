import type {
  CarIdxFrame,
  DriverInfoData,
  DriverEntry,
} from '../types/bindings';

const parseClassColor = (raw: string | null | undefined): string => {
  if (!raw) return '#888888';
  const hex = raw.replace('0x', '').replace('#', '');
  return hex.length >= 6 ? `#${hex.slice(-6)}` : '#888888';
};

export const computeDriverEntries = (
  carIdx: CarIdxFrame | null,
  driverInfo: DriverInfoData | null
): DriverEntry[] => {
  if (!driverInfo?.Drivers || !carIdx) return [];

  const playerCarIdx = driverInfo.DriverCarIdx ?? -1;
  const paceCarIdx = driverInfo.PaceCarIdx ?? -1;

  const entries: DriverEntry[] = [];

  for (const driver of driverInfo.Drivers) {
    const idx = driver.CarIdx;

    if (idx === paceCarIdx) continue;
    if (driver.IsSpectator === 1) continue;
    if (driver.CarIsPaceCar === 1) continue;

    entries.push({
      carIdx: idx,
      userName: driver.UserName,
      carNumber: driver.CarNumber ?? String(idx),
      carClassId: driver.CarClassID ?? 0,
      carClassShortName: driver.CarClassShortName ?? '',
      carClassColor: parseClassColor(driver.CarClassColor),
      carScreenName: driver.CarScreenName ?? '',
      carScreenNameShort: driver.CarScreenNameShort ?? '',
      tireCompound: '',
      position: carIdx.car_idx_position[idx] ?? 0,
      classPosition: carIdx.car_idx_class_position[idx] ?? 0,
      startPosOverall: 0,
      startPosClass: 0,
      lap: carIdx.car_idx_lap[idx] ?? 0,
      lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
      lastLapTime: carIdx.car_idx_last_lap_time[idx] ?? -1,
      bestLapTime: carIdx.car_idx_best_lap_time[idx] ?? -1,
      f2Time: carIdx.car_idx_f2_time[idx] ?? 0,
      trackSurface: carIdx.car_idx_track_surface[idx] ?? -1,
      iRating: driver.IRating ?? 0,
      licString: driver.LicString ?? '',
      licColor: parseClassColor(driver.LicColor),
      incidents: 0,
      isPlayer: idx === playerCarIdx,
      onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
      estimatedIrDelta: null,
      relativeLapDist: 0,
      estTime: carIdx.car_idx_est_time?.[idx] ?? 0,
      classEstLapTime: carIdx.car_idx_est_time?.[idx] ?? 0,
    });
  }

  const sorted = entries.sort((a, b) => a.position - b.position);

  const playerLapDist =
    sorted.find((e) => e.carIdx === playerCarIdx)?.lapDistPct ?? 0;

  for (const entry of sorted) {
    let diff = entry.lapDistPct - playerLapDist;
    if (diff < -0.5) diff += 1;
    if (diff > 0.5) diff -= 1;
    entry.relativeLapDist = diff;
  }

  return sorted;
};
