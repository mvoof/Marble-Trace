/** How far one arrow press moves a widget, in px, with and without Shift. */
const FREE_STEP_PX = 1;
const FREE_LARGE_STEP_PX = 10;
/** With snapping on, Shift moves this many grid cells at once. */
const GRID_LARGE_STEP_CELLS = 5;

export interface NudgeGrid {
  snap: boolean;
  size: number;
}

export interface NudgePoint {
  x: number;
  y: number;
}

/**
 * Where an arrow key moves a widget to, or null for any other key.
 *
 * With snapping on the widget first lands on the grid, then moves a whole cell
 * — so a widget placed off the grid by hand joins it on the first press.
 */
export const nudgedPosition = (
  position: NudgePoint,
  key: string,
  isLargeStep: boolean,
  grid: NudgeGrid
): NudgePoint | null => {
  const snap = (value: number) =>
    grid.snap ? Math.round(value / grid.size) * grid.size : value;
  const step = grid.snap
    ? grid.size * (isLargeStep ? GRID_LARGE_STEP_CELLS : 1)
    : isLargeStep
      ? FREE_LARGE_STEP_PX
      : FREE_STEP_PX;

  switch (key) {
    case 'ArrowUp':
      return { x: position.x, y: snap(position.y) - step };
    case 'ArrowDown':
      return { x: position.x, y: snap(position.y) + step };
    case 'ArrowLeft':
      return { x: snap(position.x) - step, y: position.y };
    case 'ArrowRight':
      return { x: snap(position.x) + step, y: position.y };
    default:
      return null;
  }
};

/** The step Shift gives, as the keyboard hint names it; null when free. */
export const largeGridStepPx = (grid: NudgeGrid): number | null =>
  grid.snap ? grid.size * GRID_LARGE_STEP_CELLS : null;
