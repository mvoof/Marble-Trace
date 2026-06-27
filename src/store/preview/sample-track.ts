import type { TrackPoint, TrackShapePayload } from '@/types/bindings';

// Neutral, fully synthetic track fixture shared by any consumer that needs to
// render the track map against predictable geometry (in-app widget preview,
// Storybook, …). It depends on neither the app UI nor Storybook.
//
// A recorded track only draws once real position data flows and its shape is
// whatever happened to be captured; for previews we want a stable, readable
// outline that exists from the first frame. A simple oval delivers that.

const TRACK_WIDTH = 1000;
const TRACK_HEIGHT = 600;
const CENTER_X = TRACK_WIDTH / 2;
const CENTER_Y = TRACK_HEIGHT / 2;
const RADIUS_X = 420;
const RADIUS_Y = 240;
const POINT_COUNT = 240;
const FULL_TURN = Math.PI * 2;
// Start the lap at the 6 o'clock position and run clockwise so the
// start/finish line sits at the bottom, matching most recorded ovals.
const START_ANGLE = Math.PI / 2;

const buildPoints = (): TrackPoint[] => {
  const points: TrackPoint[] = [];

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const pct = index / POINT_COUNT;
    const angle = START_ANGLE + pct * FULL_TURN;

    points.push({
      x: CENTER_X + Math.cos(angle) * RADIUS_X,
      y: CENTER_Y + Math.sin(angle) * RADIUS_Y,
      pct,
    });
  }

  return points;
};

const buildSvgPath = (points: TrackPoint[]): string => {
  const segments = points.map((point, index) => {
    const command = index === 0 ? 'M' : 'L';

    return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  });

  return `${segments.join(' ')} Z`;
};

const samplePoints = buildPoints();

export const SAMPLE_TRACK_ID = 9001;

export const sampleTrack: TrackShapePayload = {
  trackId: SAMPLE_TRACK_ID,
  viewBox: `0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`,
  svgPath: buildSvgPath(samplePoints),
  points: samplePoints,
};
