import type { DriverEntry, Session } from './bindings';

export type FlagType =
  | 'none'
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'white'
  | 'checkered'
  | 'black'
  | 'meatball'
  | 'debris'
  | 'penalty'
  | 'dq';

/**
 * iRacing Track Surface types (irsdk_TrkLoc enum)
 */
export enum TrackSurface {
  NotInWorld = 'NotInWorld',
  OffTrack = 'OffTrack',
  InPitStall = 'InPitStall',
  AproachingPits = 'AproachingPits',
  OnTrack = 'OnTrack',
}

/**
 * ResultsPosition entry from iRacing session YAML.
 * Lives inside Sessions[n].ResultsPositions and updates live during the session.
 * Not exported by specta (pitwall marks it skip), so typed manually here.
 */
type ResultsPosition = {
  CarIdx: number;
  Position: number;
  ClassPosition: number;
  Lap: number | null;
  LapsComplete: number | null;
  LapsDriven: number | null;
  FastestLap: number | null;
  FastestTime: number | null;
  LastTime: number | null;
  LapsLed: number | null;
  Incidents: number | null;
  ReasonOutId: number | null;
  ReasonOutStr: string | null;
  Time: number | null;
};

/** Session type extended with typed ResultsPositions */
export type SessionWithResults = Omit<Session, 'ResultsPositions'> & {
  ResultsPositions?: ResultsPosition[] | null;
};

export type DriverGroup = {
  classId: number;
  className: string;
  classShortName: string;
  classColor: string;
  totalDrivers: number;
  classSof: number;
  drivers: DriverEntry[];
};

export type TelemetryStatus =
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface TrackPoint {
  x: number;
  y: number;
  pct: number; // lapDistPct at this point
}

export type UnitSystem = 'metric' | 'imperial';
