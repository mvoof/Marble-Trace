import { TrackSurface } from '@/types';
import type {
  CarIdxFrame,
  DriverEntry,
  SessionSnapshot,
} from '@/types/bindings';
import { parseClassColor } from '@utils/colors';

// Mock builder for the driver list — the one the snapshot's own roster is
// turned into, rather than one invented from nothing. It lives in the factory
// with every other builder: the snapshot seeder composes it, and so does any
// fixture that needs the entries the app would have received from the backend.

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
  4108: 'M2',
  4109: 'GT3',
};

/**
 * The pit badge the backend would have resolved.
 *
 * `pitState` is computed in Rust from a car's movement through the lane, which
 * the preview has no backend to run — so without this the snapshot's six cars
 * sitting in their boxes render as ordinary rows and the pit column is empty
 * whatever the snapshot holds. Only the states a single frame can tell apart:
 * a car on its way in and a car on its way out look identical standing still,
 * so neither is guessed at.
 */
const previewPitState = (
  onPitRoad: boolean,
  trackSurface: DriverEntry['trackSurface']
): DriverEntry['pitState'] => {
  if (trackSurface === TrackSurface.InPitStall) return 'stall';

  if (onPitRoad) return 'in';

  return 'none';
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

    const onPitRoad = carIdx.car_idx_on_pit_road[idx] ?? false;
    const trackSurface =
      carIdx.car_idx_track_surface[idx] ?? TrackSurface.NotInWorld;

    entries.push({
      carIdx: idx,
      userName: car.userName,
      carNumber: car.carNumber || String(idx),
      carClassId: car.carClassId,
      carClassShortName:
        PREVIEW_CLASS_BADGES[car.carClassId] ?? car.carScreenNameShort,
      carClassColor: parseClassColor(car.carClassColor),
      flairId: car.flairId,
      isAi: car.isAi,
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
      trackSurface,
      iRating: car.iRating,
      licString: car.licString,
      licColor: parseClassColor(car.licColor),
      incidents: 0,
      isPlayer: idx === playerCarIdx,
      onPitRoad,
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
      pitState: previewPitState(onPitRoad, trackSurface),
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
