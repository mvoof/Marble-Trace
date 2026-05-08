import snapshotJson from '../../test-data/iracing-1776008424511.json';
import tracksJson from '../../test-data/tracks.json';
import type { TelemetrySnapshot } from './snapshot.types';
import { computeDriverEntries } from './compute-driver-entries';

export const snapshot = snapshotJson as unknown as TelemetrySnapshot;

const storedTracks = tracksJson as {
  'recorded-tracks': Record<string, unknown>;
};
export const trackData508 = Object.values(storedTracks['recorded-tracks'])[0];

// CarClassShortName is null in this snapshot — map by CarClassID from the session data
export const CLASS_SHORT_NAMES: Record<number, string> = {
  45: 'CTS-V',
  3002: 'F-VEE',
  4012: 'GR86',
  4073: 'MX-5',
};

export const driverEntries = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo?.DriverInfo ?? null
).map((e) => ({
  ...e,
  carClassShortName: CLASS_SHORT_NAMES[e.carClassId] ?? e.carClassShortName,
}));

export const carDynamics = snapshot.carDynamics!;
export const carInputs = snapshot.carInputs!;
export const carStatus = snapshot.carStatus!;
export const lapTiming = snapshot.lapTiming!;
export const session = snapshot.session!;
export const sessionInfo = snapshot.sessionInfo!;
export const environment = snapshot.environment!;
export const driverInfo = sessionInfo.DriverInfo;
export const weekendInfo = sessionInfo?.WeekendInfo;
