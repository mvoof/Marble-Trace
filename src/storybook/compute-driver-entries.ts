import { TrackSurface } from '@/types';
import type {
  CarIdxFrame,
  DriverEntry,
  SessionSnapshot,
} from '@/types/bindings';

const parseClassColor = (raw: string | null | undefined): string => {
  if (!raw) return '#888888';
  const hex = raw.replace('0x', '').replace('#', '');
  return hex.length >= 6 ? `#${hex.slice(-6)}` : '#888888';
};

export const computeDriverEntries = (
  carIdx: CarIdxFrame | null,
  sessionInfo: SessionSnapshot | null
): DriverEntry[] => {
  if (!sessionInfo?.cars.length || !carIdx) return [];

  const playerCarIdx = sessionInfo.playerCarIdx;

  const entries: DriverEntry[] = [];

  for (const car of sessionInfo.cars) {
    const idx = car.carIdx;

    if (car.isSpectator) continue;
    if (car.isPaceCar) continue;

    entries.push({
      carIdx: idx,
      userName: car.userName,
      carNumber: car.carNumber || String(idx),
      carClassId: car.carClassId,
      carClassShortName: car.carScreenNameShort,
      carClassColor: parseClassColor(car.carClassColor),
      carScreenName: car.carScreenName,
      carScreenNameShort: car.carScreenNameShort,
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
      trackSurface:
        carIdx.car_idx_track_surface[idx] ?? TrackSurface.NotInWorld,
      iRating: car.iRating,
      licString: car.licString,
      licColor: parseClassColor(car.licColor),
      incidents: 0,
      isPlayer: idx === playerCarIdx,
      onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
      estimatedIrDelta: null,
      relativeLapDist: 0,
      estTime: carIdx.car_idx_est_time?.[idx] ?? 0,
      classEstLapTime: carIdx.car_idx_est_time?.[idx] ?? 0,
      rawFlags: 0,
      resultsPositionLap: null,
      resultsPositionTime: null,
      pitState: 'none',
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
