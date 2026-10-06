import type { ReferenceLapData, ReferenceLapSample } from '@/types/bindings';

// Mock builders for the coach domain — the stored best lap every advisory is
// measured against. Pure: the lap is returned as a *complete* frame typed from
// the generated bindings, so a field added to the contract breaks this file
// rather than leaking silently into every fixture. Nothing here touches a
// store.

const BUCKET_COUNT = 1000;
const REFERENCE_LAP_TIME_S = 92.4;
const STRAIGHT_SPEED_KMH = 248;
const APEX_SPEED_KMH = 112;
/** Where the reference's one corner sits on the lap, as a fraction of lap distance. */
export const PREVIEW_CORNER_CENTER_PCT = 0.5;
/** How much of the lap the corner takes up, either side of the apex. */
const CORNER_HALF_WIDTH_PCT = 0.05;
/**
 * Where the reference driver gets on the brakes for it. Exported because a
 * fixture that brakes later or earlier states that as an offset from this
 * point — a second copy of the number is how a preview ends up comparing a lap
 * against a braking zone the reference does not have.
 */
export const PREVIEW_BRAKE_START_PCT = PREVIEW_CORNER_CENTER_PCT - 0.035;
/** How far past the apex the reference is still short of full throttle. */
const EXIT_WIDTH_PCT = 0.03;

const KMH_PER_MPS = 3.6;

/**
 * One braking zone into a corner and back out.
 *
 * A flat reference lap is not a reference at all: `extractCornerTargets` finds
 * no braking zone in it, the coach reports `no-corners`, and every advisory a
 * scenario forces is drawn over by "NO CORNERS". So the lap the preview seeds
 * carries a real corner — the smallest shape that makes the widget evaluate.
 */
const speedAtPct = (pct: number): number => {
  const distance = Math.abs(pct - PREVIEW_CORNER_CENTER_PCT);

  if (distance >= CORNER_HALF_WIDTH_PCT) {
    return STRAIGHT_SPEED_KMH / KMH_PER_MPS;
  }

  const depth = 1 - distance / CORNER_HALF_WIDTH_PCT;

  return (
    (STRAIGHT_SPEED_KMH - (STRAIGHT_SPEED_KMH - APEX_SPEED_KMH) * depth) /
    KMH_PER_MPS
  );
};

const sampleAtPct = (pct: number): ReferenceLapSample => {
  const braking =
    pct >= PREVIEW_BRAKE_START_PCT && pct <= PREVIEW_CORNER_CENTER_PCT;
  const exiting =
    pct > PREVIEW_CORNER_CENTER_PCT &&
    pct <= PREVIEW_CORNER_CENTER_PCT + EXIT_WIDTH_PCT;

  return {
    speed: speedAtPct(pct),
    throttle: braking
      ? 0
      : exiting
        ? (pct - PREVIEW_CORNER_CENTER_PCT) / EXIT_WIDTH_PCT
        : 1,
    brake: braking ? 1 : 0,
    latAccel: null,
    longAccel: null,
    steeringWheelAngle: 0,
  };
};

/** The speed the reference carries at a point on the lap, in km/h. */
export const referenceSpeedKmhAt = (pct: number): number =>
  speedAtPct(pct) * KMH_PER_MPS;

/**
 * A stored best lap with one corner in it — the base every coach scenario
 * states its difference against.
 */
export const mockReferenceLap = (
  overrides: Partial<ReferenceLapData> = {}
): ReferenceLapData => ({
  trackId: 0,
  carScreenName: 'Preview Car',
  lapTime: REFERENCE_LAP_TIME_S,
  samples: Array.from({ length: BUCKET_COUNT }, (_unused, index) =>
    sampleAtPct(index / BUCKET_COUNT)
  ),
  recordedWetness: null,
  recordedTireWear: null,
  recordedFuelLevel: null,
  ...overrides,
});

/**
 * A stored lap the coach can find no braking zone in — what it has when the
 * reference is an out-lap or a safety-car lap. The coach reports `no-corners`
 * against it, which is the longest wording the call row ever carries.
 */
export const mockReferenceLapWithoutCorners = (): ReferenceLapData =>
  mockReferenceLap({
    samples: mockReferenceLap().samples.map((sample) => ({
      ...sample,
      brake: 0,
    })),
  });
