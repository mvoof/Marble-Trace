import type { DriverEntry } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

const ws = (px: number) => `calc(${px}px * var(--wfs, 1))`;

// Layout constants — mirror the SCSS: column-gap sp(xxxs)=2, padding sp(sm)=8.
const COL_GAP_PX = 2;
const ROW_PAD_X_PX = 8;
const NAME_NATURAL_PX = 180; // comfortable name width for the natural design size

interface ColSpec {
  px: number;
  show: boolean;
  flex?: boolean; // the name column — 1fr
}

// Single source of truth for column order + widths (px at scale 1). Order MUST
// match the render order in DriverRow.tsx.
const colSpecs = (settings: RelativeWidgetSettings): ColSpec[] => [
  { px: 20, show: true }, // pos
  { px: 40, show: true }, // carNum
  { px: NAME_NATURAL_PX, show: true, flex: true }, // name
  { px: 48, show: settings.showLicBadge }, // lic badge
  { px: 36, show: settings.showIRating }, // iRating
  { px: 56, show: true }, // gap
];

export const buildRelativeGridTemplate = (
  settings: RelativeWidgetSettings
): string =>
  colSpecs(settings)
    .filter((col) => col.show)
    .map((col) => (col.flex ? '1fr' : ws(col.px)))
    .join(' ');

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
