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
