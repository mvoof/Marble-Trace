// Geometry of the ring badge, in the 104×104 design-pixel space of the
// prototype: the arc band is inset 9px from the badge edge and 8px thick,
// sweeping 300° clockwise from -120° (measured from 12 o'clock).
export const RING_SIZE = 104;
export const ARC_SWEEP_DEG = 300;

const RING_INSET = 9;
const RING_THICKNESS = 8;
const ARC_START_DEG = -120;
const CENTER = RING_SIZE / 2;
const RING_RADIUS = CENTER - RING_INSET - RING_THICKNESS / 2;

const toPoint = (sweepDeg: number) => {
  const angleRad = ((ARC_START_DEG + sweepDeg) * Math.PI) / 180;

  return {
    x: CENTER + RING_RADIUS * Math.sin(angleRad),
    y: CENTER - RING_RADIUS * Math.cos(angleRad),
  };
};

// The steering marker orbits the free band between the badge edge (r = CENTER)
// and the outer edge of the RPM arc (r = CENTER - RING_INSET), riding the
// middle of that band so it clears both the edge and the RPM arc.
const RIM_MARKER_EDGE_GAP = 2;
const RIM_MARKER_BAND = RING_INSET - RIM_MARKER_EDGE_GAP;
export const RIM_MARKER_RADIUS =
  CENTER - RIM_MARKER_EDGE_GAP - RIM_MARKER_BAND / 2;

/** Point on `radius` at `deg`, measured clockwise from 12 o'clock. */
export const rimPoint = (
  deg: number,
  radius: number
): { x: number; y: number } => {
  const angleRad = (deg * Math.PI) / 180;

  return {
    x: CENTER + radius * Math.sin(angleRad),
    y: CENTER - radius * Math.cos(angleRad),
  };
};

/**
 * Trail from 12 o'clock to `deg` along `radius`, following the direction the
 * marker actually travelled — `deg` is the unwrapped travel, so past a half
 * turn the trail keeps winding the long way round instead of flipping to the
 * short arc on the other side. Callers must keep |deg| under 360, which one
 * SVG arc can express.
 */
export const rimTrailPath = (deg: number, radius: number): string => {
  const start = rimPoint(0, radius);
  const end = rimPoint(deg, radius);
  const sweep = deg >= 0 ? 1 : 0;
  const largeArc = Math.abs(deg) > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
};

/** SVG path for the arc segment spanning [fromDeg, toDeg] of the 300° sweep. */
export const ringArcPath = (fromDeg: number, toDeg: number): string => {
  const start = toPoint(fromDeg);
  const end = toPoint(toDeg);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
};
