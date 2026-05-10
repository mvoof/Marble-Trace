import tracksJson from '../../test-data/tracks.json';
import type { TelemetrySnapshot } from './snapshot.types';
import { computeDriverEntries } from './compute-driver-entries';

const snapshotModules = import.meta.glob('../../test-data/iracing-*.json', {
  eager: true,
  import: 'default',
});

const firstSnapshot = Object.values(snapshotModules)[0];
if (!firstSnapshot) {
  throw new Error('No iracing-*.json snapshot found in test-data/');
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
