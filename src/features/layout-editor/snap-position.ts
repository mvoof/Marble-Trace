/**
 * The nine places the quick-placement grid can drop a widget on its screen.
 *
 * Its own file because both halves of the editor need it: the toolbar that
 * offers the corners and the editor that computes them.
 */
export type SnapPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'midLeft'
  | 'center'
  | 'midRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

/** The gap kept between a snapped widget and its screen's edge, in px. */
export const SNAP_MARGIN_PX = 8;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a widget of `size` lands on `screen` at one of the nine places, kept
 * `margin` off the edges.
 */
export const snappedPosition = (
  position: SnapPosition,
  size: { width: number; height: number },
  screen: Box,
  margin = SNAP_MARGIN_PX
): { x: number; y: number } => {
  const left = screen.x + margin;
  const right = screen.x + screen.width - size.width - margin;
  const top = screen.y + margin;
  const bottom = screen.y + screen.height - size.height - margin;
  const centerX = Math.round(screen.x + (screen.width - size.width) / 2);
  const centerY = Math.round(screen.y + (screen.height - size.height) / 2);
  const positions: Record<SnapPosition, { x: number; y: number }> = {
    topLeft: { x: left, y: top },
    topCenter: { x: centerX, y: top },
    topRight: { x: right, y: top },
    midLeft: { x: left, y: centerY },
    center: { x: centerX, y: centerY },
    midRight: { x: right, y: centerY },
    bottomLeft: { x: left, y: bottom },
    bottomCenter: { x: centerX, y: bottom },
    bottomRight: { x: right, y: bottom },
  };

  return positions[position];
};
