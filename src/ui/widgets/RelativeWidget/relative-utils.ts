import { parseClassColor } from '@utils/colors';
import type { CarEntry, CarIdxFrame, DriverEntry } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import type { PaceCarPitPhase } from '@store/widgets/pace-car.widget';

const ws = (px: number) => `calc(${px}px * var(--wfs, 1))`;

// Layout constants — mirror the SCSS: column-gap sp(xxxs)=2, padding sp(md)=10.
const COL_GAP_PX = 2;
const ROW_PAD_X_PX = 10;
const NAME_NATURAL_PX = 180; // comfortable name width for the natural design size

interface ColSpec {
  px: number;
  show: boolean;
  flex?: boolean; // the name column — 1fr
}

// Single source of truth for column order + widths (px at scale 1). Order MUST
// match the render order in DriverRow.tsx.
const colSpecs = (settings: RelativeWidgetSettings): ColSpec[] => [
  { px: 28, show: true }, // pos — wider for class color padding
  { px: 36, show: true }, // carNum — with # prefix
  { px: NAME_NATURAL_PX, show: true, flex: true }, // name
  { px: 60, show: settings.showLicBadge }, // lic badge
  { px: 36, show: settings.showIRating }, // iRating
  { px: 56, show: true }, // gap
];

export const buildRelativeGridTemplate = (
  settings: RelativeWidgetSettings
): string => {
  const parts: string[] = [];

  for (const col of colSpecs(settings)) {
    if (col.show) {
      parts.push(col.flex ? `minmax(0, 1fr)` : ws(col.px));
    }
  }

  return parts.join(' ');
};

// Natural content width of the currently-visible columns (px at scale 1) — used
// as designWidth so toggling lic/iR shrinks the widget WITHOUT shrinking text.
export const computeRelativeDesignWidth = (
  settings: RelativeWidgetSettings
): number => {
  const visible = colSpecs(settings).filter((col) => col.show);
  const columnsWidth = visible.reduce((sum, col) => sum + col.px, 0);
  const gaps = Math.max(0, visible.length - 1) * COL_GAP_PX;

  return Math.round(columnsWidth + gaps + ROW_PAD_X_PX * 2);
};

export const computeRelativeGap = (
  driver: DriverEntry,
  player: DriverEntry
): number => {
  if (driver.isPlayer) return 0;

  const isAhead = driver.relativeLapDist > 0;
  const aheadClassLapTime = isAhead
    ? driver.classEstLapTime || driver.bestLapTime
    : player.classEstLapTime || player.bestLapTime;
  const behindClassLapTime = isAhead
    ? player.classEstLapTime || player.bestLapTime
    : driver.classEstLapTime || driver.bestLapTime;

  if (!aheadClassLapTime || !behindClassLapTime) {
    return driver.estTime - player.estTime;
  }

  const scalingRatio = behindClassLapTime / aheadClassLapTime;
  const aheadEstTime = isAhead ? driver.estTime : player.estTime;
  const behindEstTime = isAhead ? player.estTime : driver.estTime;
  const aheadTimeScaled = aheadEstTime * scalingRatio;
  const referenceLapTime = behindClassLapTime;

  let delta = isAhead
    ? behindEstTime - aheadTimeScaled
    : aheadTimeScaled - behindEstTime;

  if (isAhead) {
    if (delta > referenceLapTime / 2) delta -= referenceLapTime;
  } else {
    if (delta < -referenceLapTime / 2) delta += referenceLapTime;
  }

  return delta;
};

export type PaceCarRowEntry = DriverEntry & {
  isPaceCar: true;
  pitPhase: PaceCarPitPhase;
};

const buildPaceCarRowName = (
  gameName: string,
  pitPhase: PaceCarPitPhase
): string => {
  const baseName = gameName.trim();

  if (pitPhase === 'pitIn') return `${baseName} Pit In`;

  if (pitPhase === 'pitOut') return `${baseName} Pit Out`;

  return baseName;
};

// Pace cars are excluded from the backend relative list, so they're synthesized
// here from the raw car-index frame and merged into the row list as regular
// DriverEntry-shaped rows — this lets DriverRow's existing gap/sort logic handle
// them for free. On ovals the crew uses the gap to time repairs so the car
// rejoins ahead of the pace car without losing a lap. All on-track pace cars are
// included (in multiclass sessions each class runs its own), colored by their
// own carClassColor so they read as distinct. Parked-in-pits cars are dropped
// unless showInPits is on — nothing useful to time against a stationary car.
export const buildPaceCarRowEntries = (
  carIdx: CarIdxFrame | null,
  cars: CarEntry[] | undefined,
  relativeEntries: DriverEntry[],
  getPitPhase: (carIdx: number) => PaceCarPitPhase,
  showInPits: boolean
): PaceCarRowEntry[] => {
  if (!carIdx || !cars || relativeEntries.length === 0) return [];

  const player = relativeEntries.find((entry) => entry.isPlayer);

  if (!player) return [];

  return cars.flatMap((paceCar): PaceCarRowEntry[] => {
    const idx = paceCar.carIdx;
    const paceLapDist = carIdx.car_idx_lap_dist_pct[idx] ?? -1;

    if (!paceCar.isPaceCar || paceLapDist < 0) return [];

    const pitPhase = getPitPhase(idx);

    if (!showInPits && pitPhase !== 'onTrack' && pitPhase !== 'pitOut') {
      return [];
    }

    let relativeLapDist = paceLapDist - player.lapDistPct;

    if (relativeLapDist > 0.5) relativeLapDist -= 1;
    if (relativeLapDist < -0.5) relativeLapDist += 1;

    return [
      {
        carIdx: idx,
        userName: buildPaceCarRowName(paceCar.userName, pitPhase),
        carNumber: paceCar.carNumber,
        carClassId: paceCar.carClassId,
        carClassShortName: '',
        carClassColor: parseClassColor(paceCar.carClassColor),
        carScreenName: '',
        carScreenNameShort: '',
        tireCompound: '',
        position: 0,
        classPosition: 0,
        livePosition: 0,
        liveClassPosition: 0,
        startPosOverall: 0,
        startPosClass: 0,
        lap: player.lap,
        lapDistPct: paceLapDist,
        lastLapTime: 0,
        bestLapTime: 0,
        qualifyTime: -1,
        f2Time: 0,
        estTime: carIdx.car_idx_est_time[idx] ?? 0,
        trackSurface: 'OnTrack',
        iRating: 0,
        licString: '',
        licColor: '',
        incidents: 0,
        isPlayer: false,
        onPitRoad: false,
        estimatedIrDeltaLive: null,
        estimatedIrDeltaOfficial: null,
        relativeLapDist,
        classEstLapTime: paceCar.carClassEstLapTime,
        rawFlags: 0,
        resultsPositionLap: null,
        resultsPositionTime: null,
        isRetired: false,
        isFinished: false,
        isTowed: false,
        pitState: 'none',
        isPaceCar: true,
        pitPhase,
      },
    ];
  });
};

// Merges synthetic pace-car rows into the relative list, sorted the same way
// the backend already orders relativeEntries — most-ahead first, player in the
// middle, most-behind last.
export const mergePaceCarRows = (
  relativeEntries: DriverEntry[],
  paceCarEntries: PaceCarRowEntry[]
): (DriverEntry | PaceCarRowEntry)[] => {
  if (paceCarEntries.length === 0) return relativeEntries;

  return [...relativeEntries, ...paceCarEntries].sort(
    (a, b) => b.relativeLapDist - a.relativeLapDist
  );
};

// Position number for a row. Class position comes first — in a multi-class field
// that is the number the driver races against — and the overall rank stands in
// for single-class fields, where the sim leaves class position at 0. The sim's
// official number is the last resort in both modes: it is the only one a car the
// sim has not placed on track yet ever has.
export const resolveRowPosition = (
  driver: DriverEntry,
  useLivePositions: boolean
): number => {
  if (useLivePositions) {
    return (
      driver.liveClassPosition || driver.livePosition || driver.position || 0
    );
  }

  return driver.classPosition || driver.position || 0;
};
