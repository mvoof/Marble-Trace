import type { DriverEntry } from './bindings';

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
