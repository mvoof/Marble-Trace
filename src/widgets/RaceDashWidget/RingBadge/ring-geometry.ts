// Geometry of the ring badge, in the 104×104 design-pixel space of the
// prototype: the arc band is inset 9px from the badge edge and 8px thick,
// sweeping 300° clockwise from -120° (measured from 12 o'clock).
export const RING_SIZE = 104;
export const RING_INSET = 9;
export const RING_THICKNESS = 8;
export const ARC_START_DEG = -120;
export const ARC_SWEEP_DEG = 300;

const CENTER = RING_SIZE / 2;
export const RING_RADIUS = CENTER - RING_INSET - RING_THICKNESS / 2;

const toPoint = (sweepDeg: number) => {
  const angleRad = ((ARC_START_DEG + sweepDeg) * Math.PI) / 180;

  return {
    x: CENTER + RING_RADIUS * Math.sin(angleRad),
    y: CENTER - RING_RADIUS * Math.cos(angleRad),
  };
};

// The steering marker rides the free band between the badge edge (r = CENTER)
// and the outer edge of the RPM arc (r = CENTER - RING_INSET). It is inset
// from the badge edge and fills the rest of the band, so its inner side sits
// flush against the RPM arc.
const RIM_MARKER_EDGE_GAP = 2;
export const RIM_MARKER_THICKNESS = RING_INSET - RIM_MARKER_EDGE_GAP;
export const RIM_MARKER_RADIUS =
  CENTER - RIM_MARKER_EDGE_GAP - RIM_MARKER_THICKNESS / 2;

/**
 * SVG path for a segment of `spanDeg` centered on `centerDeg`, measured
 * clockwise from 12 o'clock, on an arbitrary radius — used by the steering
 * marker, which rides the rim rather than the RPM band.
 */
export const rimArcPath = (
  centerDeg: number,
  spanDeg: number,
  radius: number
): string => {
  const pointAt = (deg: number) => {
    const angleRad = (deg * Math.PI) / 180;

    return {
      x: CENTER + radius * Math.sin(angleRad),
      y: CENTER - radius * Math.cos(angleRad),
    };
  };

  const start = pointAt(centerDeg - spanDeg / 2);
  const end = pointAt(centerDeg + spanDeg / 2);

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
};

/** SVG path for the arc segment spanning [fromDeg, toDeg] of the 300° sweep. */
export const ringArcPath = (fromDeg: number, toDeg: number): string => {
  const start = toPoint(fromDeg);
  const end = toPoint(toDeg);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
};
