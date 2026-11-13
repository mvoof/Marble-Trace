/** How far the pocket's shoulders flare out past the items, in px. */
const SHOULDER_WIDTH = 34;
/** How far the pocket's edge stands off the items, in px. */
const EDGE_GAP = 3;
/** Where the floor's straight run starts, in from each wall, in px. */
const FLOOR_INSET = 34;
/** How far the walls lean in from the items' edges as they come down, in px. */
const WALL_INSET = 10;
/** The rounded bend from wall into floor, in px. */
const FLOOR_BEND = 18;
/** How far the shoulders reach past the outer edge along the top, in px. */
const SHOULDER_OVERHANG = 10;
/** How far the shoulder curves pull toward the items, as a share of their width. */
const SHOULDER_PULL = 0.6;

export type PocketBounds = {
  /** The items' left edge, from the header's left. */
  left: number;
  width: number;
  /** The items' top and bottom, from the header's top. */
  top: number;
  bottom: number;
};

/**
 * The pocket's outline: a notch hanging from the header's top edge, its
 * shoulders flaring into it, its floor just under the items.
 */
export const pocketPath = ({ left, width, top, bottom }: PocketBounds) => {
  const right = left + width;
  const outerLeft = left - SHOULDER_WIDTH;
  const outerRight = right + SHOULDER_WIDTH;
  const shoulderPull = SHOULDER_WIDTH * SHOULDER_PULL;
  // The walls' curves aim at a point just above the items' top.
  const wallAim = top - EDGE_GAP + 2;
  const floor = bottom + EDGE_GAP;
  // Where a wall stops falling and bends into the floor.
  const bendStart = floor - FLOOR_BEND;

  return [
    `M${outerLeft - SHOULDER_OVERHANG},0`,
    `C${outerLeft + shoulderPull},0 ${left - 6},${wallAim} ${left + WALL_INSET},${bendStart}`,
    `Q${left + 14},${floor} ${left + FLOOR_INSET},${floor}`,
    `L${right - FLOOR_INSET},${floor}`,
    `Q${right - 14},${floor} ${right - WALL_INSET},${bendStart}`,
    `C${right + 6},${wallAim} ${outerRight - shoulderPull},0 ${outerRight + SHOULDER_OVERHANG},0`,
    'Z',
  ].join(' ');
};
