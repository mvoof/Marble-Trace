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
 * Country flags for the recorded snapshot's drivers.
 *
 * `FlairID` is anonymised out of the committed snapshot — every car carries
 * `0`, which the app reads as "this driver picked no flag" and draws as an
 * empty cell. So with the column switched on the preview showed a blank strip
 * and nothing to size it against. Fixture data, not a lookup: a flag is handed
 * to a car by its index, wrapping round the list, so the grid is mixed and the
 * same car keeps the same flag on every re-seed. A snapshot that does carry a flair keeps it.
 */
const PREVIEW_FLAIR_IDS = [
  222, // United Kingdom
  77, // Germany
  223, // United States
  31, // Brazil
  70, // Finland
  146, // Netherlands
  71, // France
  16, // Australia
  101, // Italy
  198, // Spain
  39, // Canada
  203, // Sweden
  13, // Argentina
  104, // Japan
  167, // Poland
  23, // Belgium
];

const previewFlairId = (flairId: number, carIdx: number): number =>
  flairId || (PREVIEW_FLAIR_IDS[carIdx % PREVIEW_FLAIR_IDS.length] ?? 0);

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

/** A GT3 on a straight, in m/s — about 245 km/h. */
const PREVIEW_TRACK_SPEED_MPS = 68;
/** How far apart two neighbours' preview speeds sit, so "who is faster" has an answer. */
const PREVIEW_SPEED_SPREAD_MPS = 0.9;
const PREVIEW_SPEED_VARIANTS = 5;
const PREVIEW_PIT_SPEED_MPS = 22;

/**
 * The speed the backend would have derived from the car's lap distance. One
 * frame has no lap distance to derive it from, so each car gets a steady speed
 * of its own instead — close enough to its neighbours to look like a fight.
 */
const previewSpeed = (
  idx: number,
  onPitRoad: boolean,
  trackSurface: DriverEntry['trackSurface']
): number => {
  if (trackSurface === TrackSurface.InPitStall) return 0;

  if (trackSurface === TrackSurface.NotInWorld) return 0;

  if (onPitRoad) return PREVIEW_PIT_SPEED_MPS;

  return (
    PREVIEW_TRACK_SPEED_MPS +
    (idx % PREVIEW_SPEED_VARIANTS) * PREVIEW_SPEED_SPREAD_MPS
  );
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
      // Already the resolved badge: the snapshot records the session as the
      // backend published it, after `sources/iracing/car_classes.rs`.
      carClassShortName: car.carClassShortName,
      carClassColor: parseClassColor(car.carClassColor),
      flairId: previewFlairId(car.flairId, idx),
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
      speed: previewSpeed(idx, onPitRoad, trackSurface),
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
