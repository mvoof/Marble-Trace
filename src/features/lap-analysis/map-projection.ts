/** Metres a degree of latitude spans; longitude shrinks with its cosine. */
const METRES_PER_DEGREE_LAT = 110_540;
const METRES_PER_DEGREE_LON = 111_320;
const DEGREES_TO_RADIANS = Math.PI / 180;

/** A lap's path on the map: metres east and south of the origin, per grid point. */
export interface ProjectedPath {
  xs: Float32Array;
  ys: Float32Array;
  /** False where the sim had no position fix. */
  fixed: Uint8Array;
  /** Where the car's nose pointed: radians from north, clockwise. */
  headings?: Float32Array;
}

/**
 * A position channel as the sim wrote it: the f32 the grid carries plus the
 * rest it lost (`LatRest`). Without the rest the line steps by half a metre.
 */
export const joinDegrees = (
  value: Float32Array,
  rest: Float32Array | null
): Float64Array =>
  Float64Array.from(value, (degrees, index) => degrees + (rest?.[index] ?? 0));

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Lat/Lon (0, 0) is a row without a fix. */
const hasFix = (lat: number, lon: number) => lat !== 0 || lon !== 0;

/** The first fixed point of a path: where the projection is centred. */
export const originOf = (
  lat: ArrayLike<number>,
  lon: ArrayLike<number>
): [number, number] | null => {
  for (let index = 0; index < lat.length; index++) {
    if (hasFix(lat[index], lon[index])) {
      return [lat[index], lon[index]];
    }
  }

  return null;
};

/** Projects a lap's positions onto a flat map, north up, y down. */
export const projectPath = (
  lat: ArrayLike<number>,
  lon: ArrayLike<number>,
  origin: [number, number],
  headings?: Float32Array
): ProjectedPath => {
  const [originLat, originLon] = origin;
  const lonScale =
    METRES_PER_DEGREE_LON * Math.cos(originLat * DEGREES_TO_RADIANS);
  const xs = new Float32Array(lat.length);
  const ys = new Float32Array(lat.length);
  const fixed = new Uint8Array(lat.length);

  for (let index = 0; index < lat.length; index++) {
    if (!hasFix(lat[index], lon[index])) {
      continue;
    }

    xs[index] = (lon[index] - originLon) * lonScale;
    ys[index] = -(lat[index] - originLat) * METRES_PER_DEGREE_LAT;
    fixed[index] = 1;
  }

  return { xs, ys, fixed, headings };
};

/** The box around the fixed points from `from` to `to` (indexes, inclusive). */
export const boundsOf = (
  path: ProjectedPath,
  from = 0,
  to = path.xs.length - 1
): MapBounds | null => {
  let bounds: MapBounds | null = null;

  for (
    let index = Math.max(from, 0);
    index <= Math.min(to, path.xs.length - 1);
    index++
  ) {
    if (path.fixed[index] === 0) {
      continue;
    }

    const x = path.xs[index];
    const y = path.ys[index];

    bounds =
      bounds === null
        ? { minX: x, minY: y, maxX: x, maxY: y }
        : {
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y),
          };
  }

  return bounds;
};

/** An SVG path of the fixed points from `from` to `to`; a gap starts a new line. */
export const svgPathOf = (
  path: ProjectedPath,
  from = 0,
  to = path.xs.length - 1
): string => {
  const parts: string[] = [];
  let drawing = false;

  for (
    let index = Math.max(from, 0);
    index <= Math.min(to, path.xs.length - 1);
    index++
  ) {
    if (path.fixed[index] === 0) {
      drawing = false;
      continue;
    }

    parts.push(
      `${drawing ? 'L' : 'M'}${path.xs[index].toFixed(1)} ${path.ys[index].toFixed(1)}`
    );
    drawing = true;
  }

  return parts.join('');
};

/** The grid point of `path` nearest to (x, y), within `maxDistance`; `null` when none is. */
export const nearestPoint = (
  path: ProjectedPath,
  x: number,
  y: number,
  maxDistance: number
): number | null => {
  let nearest: number | null = null;
  let nearestSquared = maxDistance * maxDistance;

  for (let index = 0; index < path.xs.length; index++) {
    if (path.fixed[index] === 0) {
      continue;
    }

    const squared = (path.xs[index] - x) ** 2 + (path.ys[index] - y) ** 2;

    if (squared <= nearestSquared) {
      nearest = index;
      nearestSquared = squared;
    }
  }

  return nearest;
};

/** Points either side the direction of travel is read over. */
const TANGENT_SPAN = 4;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/** The direction of travel at `index`, a unit vector on the map (y down). */
export const tangentAt = (
  path: ProjectedPath,
  index: number
): [number, number] => {
  const before = Math.max(index - TANGENT_SPAN, 0);
  const after = Math.min(index + TANGENT_SPAN, path.xs.length - 1);
  const dx = path.xs[after] - path.xs[before];
  const dy = path.ys[after] - path.ys[before];
  const length = Math.hypot(dx, dy) || 1;

  return [dx / length, dy / length];
};

/** The direction of travel at `index` as an SVG rotation: degrees from east, clockwise. */
export const headingDegreesAt = (
  path: ProjectedPath,
  index: number
): number => {
  const [dx, dy] = tangentAt(path, index);

  return Math.atan2(dy, dx) * RADIANS_TO_DEGREES;
};

/** A quarter turn: SVG rotation counts from east, a heading from north. */
const NORTH_TO_EAST_DEGREES = 90;

/**
 * Where the car's nose pointed at `index` as an SVG rotation; the direction
 * of travel when the lap has no headings.
 */
export const noseDegreesAt = (path: ProjectedPath, index: number): number =>
  path.headings === undefined
    ? headingDegreesAt(path, index)
    : path.headings[index] * RADIANS_TO_DEGREES - NORTH_TO_EAST_DEGREES;
