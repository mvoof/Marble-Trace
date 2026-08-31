import { TrackSurface } from '@/types';
import type {
  CarIdxFrame,
  DriverEntry,
  SessionSnapshot,
} from '@/types/bindings';
import { parseClassColor } from '@utils/colors';

/**
 * Badges for the classes in the recorded snapshot.
 *
 * In the app the badge is resolved in Rust (`sources/iracing/car_classes.rs`)
 * before the frontend ever sees an entry. The preview has no backend, and the
 * snapshot stores the raw session — every car's `CarClassShortName` is empty,
 * so without this the preview shows car names ("BMW M2 Racing (G87)") in a
 * column the app fills with "M2". Fixture data, not a second resolver: it only
 * covers the class ids this snapshot holds.
 */
const PREVIEW_CLASS_BADGES: Record<number, string> = {
  74: 'MX-5',
  3002: 'FVee',
  4012: 'GR86',
  4102: 'M2',
  4109: 'GT3',
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
      carClassShortName:
        PREVIEW_CLASS_BADGES[car.carClassId] ?? car.carScreenNameShort,
      carClassColor: parseClassColor(car.carClassColor),
      flairId: car.flairId,
      carScreenName: car.carScreenName,
      carScreenNameShort: car.carScreenNameShort,
      tireCompound: '',
      position: carIdx.car_idx_position[idx] ?? 0,
      classPosition: carIdx.car_idx_class_position[idx] ?? 0,
      livePosition: carIdx.car_idx_position[idx] ?? 0,
      liveClassPosition: carIdx.car_idx_class_position[idx] ?? 0,
      startPosOverall: 0,
      startPosClass: 0,
      lap: carIdx.car_idx_lap[idx] ?? 0,
      lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
      lastLapTime: carIdx.car_idx_last_lap_time[idx] ?? -1,
      bestLapTime: carIdx.car_idx_best_lap_time[idx] ?? -1,
      qualifyTime: -1,
      f2Time: carIdx.car_idx_f2_time[idx] ?? 0,
      trackSurface:
        carIdx.car_idx_track_surface[idx] ?? TrackSurface.NotInWorld,
      iRating: car.iRating,
      licString: car.licString,
      licColor: parseClassColor(car.licColor),
      incidents: 0,
      isPlayer: idx === playerCarIdx,
      onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
      estimatedIrDeltaLive: null,
      estimatedIrDeltaOfficial: null,
      relativeLapDist: 0,
      estTime: carIdx.car_idx_est_time?.[idx] ?? 0,
      classEstLapTime: carIdx.car_idx_est_time?.[idx] ?? 0,
      rawFlags: 0,
      resultsPositionLap: null,
      resultsPositionTime: null,
      isRetired: false,
      isFinished: false,
      isTowed: false,
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
