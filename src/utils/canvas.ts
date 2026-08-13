export type CarDotShape = 'circle' | 'square' | 'diamond';

/**
 * Shapes handed out to car classes in speed order — the fastest class keeps the
 * plain circle so a single-class field looks exactly as it always did. The sim
 * gives no per-class shape, so the cycle repeats once the classes run out.
 */
const SHAPE_CYCLE: CarDotShape[] = ['circle', 'square', 'diamond'];

/**
 * Half-side per unit of the dot radius, sized to keep the car number readable.
 * The diamond is the same square, only tilted, so both share one scale.
 */
const HALF_SIDE_SCALE = 0.9;

/** Tilt that turns the square into a diamond without rotating the car number. */
const SHAPE_ROTATION_DEG: Record<Exclude<CarDotShape, 'circle'>, number> = {
  square: 0,
  diamond: 45,
};

/** Corner rounding as a share of the half-side. */
const CORNER_SCALE = 0.25;

export interface CarDotRect {
  /** Distance from the center to an edge — half of the drawn side. */
  halfSide: number;
  cornerRadius: number;
  rotationDeg: number;
}

export const shapeForClassOrder = (classOrder: number): CarDotShape => {
  if (classOrder < 0) {
    return 'circle';
  }

  return SHAPE_CYCLE[classOrder % SHAPE_CYCLE.length];
};

/** Rounded-square geometry for a shape, or `null` when it is drawn as a circle. */
export const carDotRect = (
  shape: CarDotShape,
  radius: number
): CarDotRect | null => {
  if (shape === 'circle') {
    return null;
  }

  const halfSide = radius * HALF_SIDE_SCALE;

  return {
    halfSide,
    cornerRadius: halfSide * CORNER_SCALE,
    rotationDeg: SHAPE_ROTATION_DEG[shape],
  };
};

/**
 * Sizes a canvas' backing store to the display density and returns its context
 * already scaled, so every draw call works in CSS pixels.
 *
 * Assigning `width`/`height` resets the context transform, so the scale is
 * re-applied on every resize — and only then, since a redundant assignment
 * clears the canvas.
 */
export const resizeCanvasToDpr = (
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  const deviceWidth = Math.round(cssWidth * dpr);
  const deviceHeight = Math.round(cssHeight * dpr);

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return ctx;
};

export interface CellDividers {
  right: boolean;
  top: boolean;
}

// Hairlines live on the inner edges of a grid only, so the outer frame stays clean.
export const getCellDividers = (
  index: number,
  cols: number,
  total: number
): CellDividers => {
  const isLastColumn = (index + 1) % cols === 0;
  const isLastCell = index === total - 1;

  return {
    right: !isLastColumn && !isLastCell,
    top: index >= cols,
  };
};

/** How much a list holds against how much of it is on screen. */
export type ScrollMetrics = { total: number; windowSize: number };

/** Thumb geometry in percent of its track. */
export type ScrollThumb = { heightPercent: number; topPercent: number };

/**
 * Where a zero offset parks the window: chat counts up from the newest message
 * at the bottom, the standings table counts down from the leader at the top.
 */
export type ScrollAnchor = 'top' | 'bottom';

// A thumb thinner than this stops reading as a handle on a long list.
const MIN_THUMB_PERCENT = 12;

/**
 * Thumb for a list that is windowed in a store rather than by a scroll
 * container, or null while the whole list is on screen and there is nothing to
 * indicate. The size floor keeps the thumb grabbable-looking on a long list, so
 * the offset is mapped onto the leftover track rather than onto the raw count.
 */
export const scrollThumbFor = (
  metrics: ScrollMetrics | undefined,
  offset: number,
  anchor: ScrollAnchor = 'top'
): ScrollThumb | null => {
  if (!metrics) {
    return null;
  }

  const { total, windowSize } = metrics;
  const maxOffset = Math.max(0, total - windowSize);

  if (maxOffset === 0 || windowSize <= 0) {
    return null;
  }

  const heightPercent = Math.max(MIN_THUMB_PERCENT, (windowSize / total) * 100);
  const progress = Math.min(1, Math.max(0, offset) / maxOffset);
  const travelled = anchor === 'bottom' ? 1 - progress : progress;

  return {
    heightPercent,
    topPercent: (100 - heightPercent) * travelled,
  };
};
