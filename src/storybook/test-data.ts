import { sampleSnapshot } from '@store/preview/sample-telemetry';
import { computeDriverEntries } from '@store/preview/compute-driver-entries';
import { sampleTrack } from '@store/preview/sample-track';

// Storybook adapts to the app's data and formats — it consumes the neutral
// preview fixtures, never the other way around. The app never imports from here.
export const snapshot = sampleSnapshot;

export const trackData = {
  svgPath: sampleTrack.svgPath,
  viewBox: sampleTrack.viewBox,
  points: sampleTrack.points,
};

export const driverEntries = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo ?? null
);
