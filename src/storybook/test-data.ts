import snapshotJson from '../../test-data/iracing-1776008424511.json';
import tracksJson from '../../test-data/tracks.json';
import type { TelemetrySnapshot } from './snapshot.types';
import { computeDriverEntries } from './compute-driver-entries';

export const snapshot = snapshotJson as unknown as TelemetrySnapshot;

const storedTracks = tracksJson as {
  'recorded-tracks': Record<string, unknown>;
};
export const trackData508 = Object.values(storedTracks['recorded-tracks'])[0];

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
