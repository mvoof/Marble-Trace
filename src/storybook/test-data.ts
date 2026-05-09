import tracksJson from '../../test-data/tracks.json';
import type { TelemetrySnapshot } from './snapshot.types';
import { computeDriverEntries } from './compute-driver-entries';

const trackSnapshotModules = import.meta.glob('../../test-data/track-*.json', {
  eager: true,
  import: 'default',
});

const firstSnapshot = Object.values(trackSnapshotModules)[0];
if (!firstSnapshot) {
  throw new Error('No track-*.json snapshot found in test-data/');
}

export const snapshot = firstSnapshot as unknown as TelemetrySnapshot;

interface StoredTrack {
  svgPath: string;
  viewBox: string;
  points: { x: number; y: number; pct: number }[];
  trackName: string;
}

const storedTracks = tracksJson as {
  'recorded-tracks': Record<string, StoredTrack>;
};
export const trackData = Object.values(storedTracks['recorded-tracks'])[0];

export const driverEntries = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo?.DriverInfo ?? null
);

export const carDynamics = snapshot.carDynamics!;
export const carInputs = snapshot.carInputs!;
export const carStatus = snapshot.carStatus!;
export const lapTiming = snapshot.lapTiming!;
export const session = snapshot.session!;
export const sessionInfo = snapshot.sessionInfo!;
export const environment = snapshot.environment!;
export const driverInfo = sessionInfo.DriverInfo;
export const weekendInfo = sessionInfo?.WeekendInfo;
