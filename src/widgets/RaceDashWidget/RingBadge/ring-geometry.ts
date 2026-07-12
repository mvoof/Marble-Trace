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

/** SVG path for the arc segment spanning [fromDeg, toDeg] of the 300° sweep. */
export const ringArcPath = (fromDeg: number, toDeg: number): string => {
  const start = toPoint(fromDeg);
  const end = toPoint(toDeg);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
};
