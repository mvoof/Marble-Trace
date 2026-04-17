import type { CarIdxFrame, DriverInfoData } from '../../types/bindings';
import { parseClassColor } from '../../utils/class-color';

// ─── Track surface constants ───────────────────────────────────────────────

export const TRACK_SURFACE_OFF_TRACK = 0;
export const TRACK_SURFACE_IN_PIT_STALL = 1;
export const TRACK_SURFACE_ON_TRACK = 3;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

// ─── Class label constants ─────────────────────────────────────────────────

export const NO_CLASS_LABEL = 'No Class';
export const NO_CLASS_COLOR = '#888888';

// ─── Trend sampling ───────────────────────────────────────────────────────

export const TREND_SAMPLE_INTERVAL_MS = 2000;

// ─── Formatters ───────────────────────────────────────────────────────────

const BADGE_EXCEPTIONS: Record<string, string> = {
  'Formula Vee': 'FVee',
  'Ray FF1600': 'FF1600',
  'Global Mazda MX-5 Cup': 'MX-5',
  "Legends Ford '34 Coupe": 'Legends',
  'Skip Barber Formula 2000': 'Skippy',
  'Dirt Sprint Car': 'Sprint',
  'Dirt Late Model': 'DLM',
};

const BRANDS_TO_STRIP = [
  'Toyota ',
  'Cadillac ',
  'Porsche ',
  'Ferrari ',
  'BMW ',
  'Mercedes-AMG ',
  'Dallara ',
  'Chevrolet ',
  'Ford ',
  'Aston Martin ',
  'Audi ',
  'McLaren ',
  'Honda ',
  'Hyundai ',
  'Nissan ',
  'Radical ',
  'Renault ',
  'Volkswagen ',
];

const FLUFF_TO_STRIP = [
  ' Racecar',
  ' Cup',
  ' Series',
  ' Global',
  ' Track',
  ' Sprint',
  ' Lite',
];

export const getCompactBadgeName = (screenNameShort: string): string => {
  if (!screenNameShort) return '—';

  if (BADGE_EXCEPTIONS[screenNameShort])
    return BADGE_EXCEPTIONS[screenNameShort];

  let badge = screenNameShort;

  for (const brand of BRANDS_TO_STRIP) {
    if (badge.startsWith(brand)) {
      badge = badge.slice(brand.length);
      break;
    }
  }

  for (const fluff of FLUFF_TO_STRIP) {
    badge = badge.replace(fluff, '');
  }

  badge = badge.trim();

  if (badge.length > 8) {
    const abbr = badge.match(/[A-Z0-9]/g)?.join('') ?? '';
    if (abbr.length > 1 && abbr.length <= 5) return abbr;
  }

  return badge;
};

export const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

export const formatBrand = (screenName: string): string => {
  if (!screenName) return '';
  return screenName.split(' ')[0] ?? screenName;
};

// ─── Types ────────────────────────────────────────────────────────────────

export interface DriverEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
  carClassId: number;
  carClassShortName: string;
  carClassColor: string;
  carScreenName: string;
  carScreenNameShort: string;
  tireCompound: string;
  position: number;
  classPosition: number;
  startPosOverall: number;
  startPosClass: number;
  lap: number;
  lapDistPct: number;
  lastLapTime: number;
  bestLapTime: number;
  f2Time: number;
  trackSurface: number;
  iRating: number;
  licString: string;
  licColor: string;
  incidents: number;
  isPlayer: boolean;
  onPitRoad: boolean;
}

export interface SeparatorEntry {
  isSeparator: true;
  id: string;
}

export interface DriverGroup {
  classId: number;
  className: string;
  classShortName: string;
  classColor: string;
  totalDrivers: number;
  classSof: number;
  drivers: (DriverEntry | SeparatorEntry)[];
}

export const isSeparator = (
  entry: DriverEntry | SeparatorEntry
): entry is SeparatorEntry => 'isSeparator' in entry && entry.isSeparator;

// ─── Computations ─────────────────────────────────────────────────────────

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

export const computeDriverEntries = (
  carIdx: CarIdxFrame | null,
  driverInfo: DriverInfoData | null,
  startPositions: Map<number, { overall: number; class: number }> = new Map()
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
        carClassShortName:
          getCompactBadgeName(driver.CarScreenNameShort ?? '') ||
          NO_CLASS_LABEL,
        carClassColor: driver.CarClassColor
          ? parseClassColor(driver.CarClassColor)
          : NO_CLASS_COLOR,
        carScreenName: driver.CarScreenName ?? '',
        carScreenNameShort: driver.CarScreenNameShort || NO_CLASS_LABEL,
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

export const sortByRelativeLapDist = (
  entries: DriverEntry[],
  playerCarIdx: number
): DriverEntry[] => {
  const playerLapDistPct =
    entries.find((e) => e.carIdx === playerCarIdx)?.lapDistPct ?? 0;

  const relativeDiff = (other: number): number => {
    let diff = other - playerLapDistPct;
    if (diff < -0.5) diff += 1;
    if (diff > 0.5) diff -= 1;
    return diff;
  };

  return [...entries].sort(
    (a, b) => relativeDiff(b.lapDistPct) - relativeDiff(a.lapDistPct)
  );
};
