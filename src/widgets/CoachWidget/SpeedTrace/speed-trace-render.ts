import type { TracePoint, TraceWindow } from '@store/widgets/coach-trace-utils';
import { traceSpeedRange } from '@store/widgets/coach-trace-utils';

export interface SpeedTraceColors {
  reference: string;
  gain: string;
  loss: string;
  grid: string;
  marker: string;
}

/** Horizontal grid lines drawn behind the traces. */
const GRID_LINE_COUNT = 3;
/** Share of the speed range added above and below so the curves never touch the edges. */
const RANGE_PADDING = 0.12;
/** Speed range (m/s) forced open when both traces are nearly flat, so a straight does not amplify noise. */
const MIN_SPEED_RANGE_MPS = 5;
const REFERENCE_LINE_WIDTH = 1.75;
const OWN_LINE_WIDTH = 2.25;
const MARKER_RADIUS = 2.75;
const MARKER_DASH: [number, number] = [3, 3];
/** Below this magnitude (seconds) the delta is called even and drawn neutral. */
const EVEN_DELTA_S = 0.005;

interface Projection {
  x: (offsetM: number) => number;
  y: (speedMps: number) => number;
}

const buildProjection = (
  points: TracePoint[],
  width: number,
  height: number
): Projection | null => {
  const range = traceSpeedRange(points);
  const first = points[0];
  const last = points.at(-1);

  if (!range || !first || !last) return null;

  const span = Math.max(last.offsetM - first.offsetM, 1);
  const padding = Math.max(
    (range.max - range.min) * RANGE_PADDING,
    MIN_SPEED_RANGE_MPS / 2
  );
  const low = range.min - padding;
  const high = range.max + padding;
  const speedSpan = Math.max(high - low, 1);

  return {
    x: (offsetM) => ((offsetM - first.offsetM) / span) * width,
    // Faster is higher up, the way a speed trace is read everywhere else.
    y: (speedMps) => height - ((speedMps - low) / speedSpan) * height,
  };
};

const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  for (let index = 1; index <= GRID_LINE_COUNT; index++) {
    const y = Math.round((height / (GRID_LINE_COUNT + 1)) * index) + 0.5;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
};

const drawReference = (
  ctx: CanvasRenderingContext2D,
  points: TracePoint[],
  projection: Projection,
  color: string
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = REFERENCE_LINE_WIDTH;
  ctx.beginPath();

  let started = false;

  for (const point of points) {
    if (point.referenceSpeed === null) {
      started = false;
      continue;
    }

    const x = projection.x(point.offsetM);
    const y = projection.y(point.referenceSpeed);

    if (started) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      started = true;
    }
  }

  ctx.stroke();
};

/**
 * The lap in progress, drawn segment by segment so each one carries the color
 * of the running time delta at that point: green where this lap is up on the
 * reference, red where it is down. That is the whole point of the trace — the
 * shape says what was done, the color says what it cost.
 */
const drawOwnTrace = (
  ctx: CanvasRenderingContext2D,
  points: TracePoint[],
  projection: Projection,
  colors: SpeedTraceColors
) => {
  ctx.lineWidth = OWN_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];

    if (
      !previous ||
      !current ||
      previous.ownSpeed === null ||
      current.ownSpeed === null
    ) {
      continue;
    }

    const deltaS = current.timeDeltaS;

    ctx.strokeStyle =
      deltaS === null || Math.abs(deltaS) < EVEN_DELTA_S
        ? colors.marker
        : deltaS > 0
          ? colors.loss
          : colors.gain;

    ctx.beginPath();
    ctx.moveTo(projection.x(previous.offsetM), projection.y(previous.ownSpeed));
    ctx.lineTo(projection.x(current.offsetM), projection.y(current.ownSpeed));
    ctx.stroke();
  }
};

/** Dashed line and dot at the car's current position — where the own trace ends. */
const drawNowMarker = (
  ctx: CanvasRenderingContext2D,
  points: TracePoint[],
  projection: Projection,
  height: number,
  colors: SpeedTraceColors
) => {
  const now = points.reduce<TracePoint | null>(
    (closest, point) =>
      closest === null || Math.abs(point.offsetM) < Math.abs(closest.offsetM)
        ? point
        : closest,
    null
  );

  if (!now) return;

  const x = Math.round(projection.x(now.offsetM)) + 0.5;

  ctx.save();
  ctx.setLineDash(MARKER_DASH);
  ctx.strokeStyle = colors.marker;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.restore();

  if (now.ownSpeed === null) return;

  const deltaS = now.timeDeltaS;

  ctx.fillStyle =
    deltaS === null || Math.abs(deltaS) < EVEN_DELTA_S
      ? colors.marker
      : deltaS > 0
        ? colors.loss
        : colors.gain;

  ctx.beginPath();
  ctx.arc(x, projection.y(now.ownSpeed), MARKER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
};

export const drawSpeedTrace = (
  canvas: HTMLCanvasElement,
  window: TraceWindow,
  colors: SpeedTraceColors
) => {
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  const dpr = globalThis.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.clearRect(0, 0, width, height);

  if (width <= 0 || height <= 0) return;

  drawGrid(ctx, width, height, colors.grid);

  const projection = buildProjection(window.points, width, height);

  if (!projection) return;

  drawReference(ctx, window.points, projection, colors.reference);
  drawOwnTrace(ctx, window.points, projection, colors);
  drawNowMarker(ctx, window.points, projection, height, colors);
};
