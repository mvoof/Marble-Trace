export interface DriverEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
  carClassId: number;
  carClassShortName: string;
  carClassColor: string;
  carScreenName: string;
  /** TireCompoundType label resolved via DriverInfo.DriverTires (e.g. Soft/Wet) */
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
