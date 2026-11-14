import { parseClassColor } from '@shared/lib/colors';
import type {
  CarEntry,
  CarIdxFrame,
} from '@shared/contracts/generated/bindings';
import type { DriverEntry } from '@shared/contracts/driver-entry';
import type { CarIdentity } from '@shared/contracts/car-identity';
import type { PaceCarPitPhase } from '@shared/contracts/generated/bindings';
import {
  chipColumnCss,
  columnPx,
  fontScaleOf,
  type WithFontScale,
  irChipWidth,
  ratingChipParts,
  srChipWidth,
  type ChipWidth,
} from '@shared/ui/StatChip/rating';
import { normalizeOrder } from '@shared/lib/widget-settings-dsl';
import type { RelativeWidgetSettings } from './settings-schema';
import { RELATIVE_COLUMNS, type RelativeColumn } from './relative-columns';

const ws = (px: number) => `calc(${px}px * var(--wfs, 1))`;

// Layout constants — mirror the SCSS: column-gap sp(xxxs)=2, padding sp(md)=10.
const COL_GAP_PX = 2;
const ROW_PAD_X_PX = 10;
// Inner padding on each side of a value cell — sp(xxs) in the SCSS — so a value
// never touches the edge of its column stripe. Position and name carry their own.
const CELL_PAD_X_PX = 4;

const padded = (contentPx: number): number => contentPx + CELL_PAD_X_PX * 2;

// The name column is fixed, not elastic — see the same note in standings-utils.
export const NAME_COLUMN_MIN_PX = 80;
export const NAME_COLUMN_MAX_PX = 300;
export const NAME_COLUMN_DEFAULT_PX = 180;

const DISTANCE_COLUMN_PX = 60;

const clampNameColumnWidth = (width: number | undefined) => {
  if (!Number.isFinite(width)) {
    return NAME_COLUMN_DEFAULT_PX;
  }

  return Math.min(
    NAME_COLUMN_MAX_PX,
    Math.max(NAME_COLUMN_MIN_PX, Math.round(width as number))
  );
};

/**
 * The groups a thin rule divides the row into: who the driver is, how rated,
 * where on track. Rules sit between groups, never between the columns of one.
 */
type ColumnBlock = 'driver' | 'rating' | 'track';

const COLUMN_BLOCKS: Record<RelativeColumn, ColumnBlock> = {
  pos: 'driver',
  carNumber: 'driver',
  countryFlag: 'driver',
  name: 'driver',
  sr: 'rating',
  ir: 'rating',
  gap: 'track',
  distance: 'track',
};

interface ColSpec {
  px: number;
  /** The track as CSS, when it is more than `px` at the widget's scale. */
  css?: string;
  show: boolean;
}

// A chip's column: the chip's own width and the cell's padding, growing with
// the font scale as the chip's digits do.
const chipColumn = (
  width: ChipWidth | null,
  settings: WithFontScale<RelativeWidgetSettings>
): ColSpec => ({
  // The design width is what the grid really draws, the font scale too — else a
  // scaled-up chip pushes the last column out of the frame.
  px:
    width === null
      ? 0
      : columnPx(width, CELL_PAD_X_PX * 2, fontScaleOf(settings)),
  css: width === null ? undefined : chipColumnCss(width, CELL_PAD_X_PX * 2),
  show: width !== null,
});

// Widths of every column (px at scale 1).
const columnSpecs = (
  settings: WithFontScale<RelativeWidgetSettings>
): Record<RelativeColumn, ColSpec> => {
  const { sr, ir } = ratingChipParts(settings);

  return {
    pos: { px: 28, show: settings.showPosition },
    carNumber: { px: padded(40), show: settings.showCarNumber }, // class-colored badge
    countryFlag: { px: padded(22), show: settings.showCountryFlag },
    // fixed, user-sized
    name: {
      px: clampNameColumnWidth(settings.nameColumnWidth),
      show: settings.showDriverName,
    },
    // The safety rating and the iRating, each a column — the same columns
    // Standings has, so the two tables line up when stacked.
    sr: chipColumn(srChipWidth(sr, settings.licBadgeStyle), settings),
    ir: chipColumn(irChipWidth(ir), settings),
    gap: { px: padded(56), show: settings.showGap },
    // Five digits and the unit ("41010 ft"), half a lap of the Nordschleife.
    distance: { px: padded(DISTANCE_COLUMN_PX), show: settings.showDistance },
  };
};

/**
 * The columns the strip draws, left to right, in the order the settings give
 * — the one order the grid, the driver rows and the pace car row follow. A
 * missing order is the shipped one.
 */
export const visibleRelativeColumns = (
  settings: WithFontScale<RelativeWidgetSettings>
): RelativeColumn[] => {
  const specs = columnSpecs(settings);

  return normalizeOrder(settings.columnOrder ?? [], RELATIVE_COLUMNS).filter(
    (column) => specs[column].show
  );
};

const colSpecs = (
  settings: WithFontScale<RelativeWidgetSettings>
): ColSpec[] => {
  const specs = columnSpecs(settings);

  return visibleRelativeColumns(settings).map((column) => specs[column]);
};

/**
 * The visible columns that close a group with another group after them — the
 * cells that carry the thin rule on their right edge.
 */
export const buildRelativeBlockEnds = (
  settings: RelativeWidgetSettings
): ReadonlySet<RelativeColumn> => {
  const visible = visibleRelativeColumns(settings);

  return new Set(
    visible.filter((column, index) => {
      const next = visible[index + 1];

      return (
        next !== undefined && COLUMN_BLOCKS[next] !== COLUMN_BLOCKS[column]
      );
    })
  );
};

export const buildRelativeGridTemplate = (
  settings: RelativeWidgetSettings
): string => {
  const parts: string[] = [];

  for (const col of colSpecs(settings)) {
    parts.push(col.css ?? ws(col.px));
  }

  return parts.join(' ');
};

// Natural content width of the currently-visible columns (px at scale 1) — used
// as designWidth so toggling lic/iR shrinks the widget WITHOUT shrinking text.
export const computeRelativeDesignWidth = (
  settings: WithFontScale<RelativeWidgetSettings>
): number => {
  const visible = colSpecs(settings);
  const columnsWidth = visible.reduce((sum, col) => sum + col.px, 0);
  const gaps = Math.max(0, visible.length - 1) * COL_GAP_PX;

  return Math.round(columnsWidth + gaps + ROW_PAD_X_PX * 2);
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
        teamName: '',
        carNumber: paceCar.carNumber,
        carClassId: paceCar.carClassId,
        carClassShortName: '',
        carClassColor: parseClassColor(paceCar.carClassColor),
        flairId: 0,
        isAi: false,
        carScreenName: '',
        carScreenNameShort: '',
        tireCompound: '',
        position: 0,
        classPosition: 0,
        livePosition: 0,
        liveClassPosition: 0,
        startPosOverall: null,
        startPosClass: null,
        lap: player.lap,
        lapDistPct: paceLapDist,
        lastLapTime: null,
        bestLapTime: null,
        qualifyTime: null,
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
        speed: null,
        pitLap: null,
        pitElapsedS: null,
        lastPitS: null,
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
  driver: CarIdentity,
  useLivePositions: boolean
): number => {
  if (useLivePositions) {
    return (
      driver.liveClassPosition || driver.livePosition || driver.position || 0
    );
  }

  return driver.classPosition || driver.position || 0;
};
