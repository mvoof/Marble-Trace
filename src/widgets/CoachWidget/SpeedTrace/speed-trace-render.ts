import {
  traceValueRange,
  TRACE_POINT_COUNT,
  type TraceWindowBuffers,
  type TraceWindowStats,
} from '@store/widgets/coach-trace-utils';
import type { CoachTraceChannel } from '@/types/widget-settings';

export interface SpeedTraceColors {
  reference: string;
  gain: string;
  loss: string;
  grid: string;
  marker: string;
}

/** Horizontal grid lines drawn behind the traces. */
const GRID_LINE_COUNT = 3;
/** Share of the canvas height left clear above and below a braking mark. */
const BRAKE_MARK_INSET_RATIO = 0.12;
/** Share of the value range added above and below so the curves never touch the edges. */
const RANGE_PADDING = 0.12;
/** Speed range (m/s) forced open when both traces are nearly flat, so a straight does not amplify noise. */
const MIN_SPEED_RANGE_MPS = 5;
const REFERENCE_LINE_WIDTH = 1.75;
const OWN_LINE_WIDTH = 2.25;
const BRAKE_MARK_WIDTH = 1.5;
const MARKER_RADIUS = 2.75;
const NOW_DASH: [number, number] = [3, 3];
const BRAKE_MARK_DASH: [number, number] = [2, 3];
/** Braking marks are drawn dimmer than the lines they belong to — they mark a point, they are not a signal of their own. */
const BRAKE_MARK_ALPHA = 0.55;
/** Below this magnitude (seconds) the delta is called even and drawn neutral. */
const EVEN_DELTA_S = 0.005;

interface Projection {
  x: (offsetM: number) => number;
  y: (value: number) => number;
}

/** The pair of traces the chosen channel draws. */
interface Channel {
  reference: Float32Array;
  own: Float32Array;
  /** Fixed vertical range, or null to scale to what is in the window. */
  fixedRange: { min: number; max: number } | null;
}

const isValue = (value: number | undefined): value is number =>
  value !== undefined && !Number.isNaN(value);

const channelFor = (
  buffers: TraceWindowBuffers,
  channel: CoachTraceChannel
): Channel =>
  channel === 'brake'
    ? {
        reference: buffers.referenceBrake,
        own: buffers.ownBrake,
        // Pedal travel is already 0-1 and its absolute level is the point —
        // autoscaling would make a feather-light brush of the pedal look like
        // a full stop.
        fixedRange: { min: 0, max: 1 },
      }
    : {
        reference: buffers.referenceSpeed,
        own: buffers.ownSpeed,
        fixedRange: null,
      };

const buildProjection = (
  buffers: TraceWindowBuffers,
  channel: Channel,
  width: number,
  height: number
): Projection | null => {
  const range =
    channel.fixedRange ?? traceValueRange(channel.reference, channel.own);
  const first = buffers.offsetM[0];
  const last = buffers.offsetM.at(-1);

  if (!range || first === undefined || last === undefined) return null;

  const span = Math.max(last - first, 1);
  const padding = channel.fixedRange
    ? 0
    : Math.max(
        (range.max - range.min) * RANGE_PADDING,
        MIN_SPEED_RANGE_MPS / 2
      );
  const low = range.min - padding;
  const valueSpan = Math.max(range.max + padding - low, Number.EPSILON);

  return {
    x: (offsetM) => ((offsetM - first) / span) * width,
    // More is higher up, the way a speed trace is read everywhere else.
    y: (value) => height - ((value - low) / valueSpan) * height,
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
  buffers: TraceWindowBuffers,
  values: Float32Array,
  projection: Projection,
  color: string
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = REFERENCE_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let started = false;

  for (let index = 0; index < TRACE_POINT_COUNT; index++) {
    const value = values[index];
    const offsetM = buffers.offsetM[index];

    if (!isValue(value) || !isValue(offsetM)) {
      started = false;
      continue;
    }

    const x = projection.x(offsetM);
    const y = projection.y(value);

    if (started) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      started = true;
    }
  }

  ctx.stroke();
};

const deltaColor = (
  deltaS: number | undefined,
  colors: SpeedTraceColors
): string => {
  if (!isValue(deltaS) || Math.abs(deltaS) < EVEN_DELTA_S) {
    return colors.marker;
  }

  return deltaS > 0 ? colors.loss : colors.gain;
};

/**
 * The lap in progress, colored by the running time delta: green where this lap
 * is up on the reference, red where it is down. That is the whole point of the
 * trace — the shape says what was done, the color says what it cost. The colour
 * comes from the time delta whichever channel is drawn, because the pedal alone
 * says nothing about whether it worked.
 *
 * Drawn as one stroked path per colour run rather than one path per segment:
 * stroking every segment on its own leaves a visible seam at each joint and
 * reads as a dashed line. Each run starts at the previous run's last point so
 * the colours meet without a gap.
 */
const drawOwnTrace = (
  ctx: CanvasRenderingContext2D,
  buffers: TraceWindowBuffers,
  values: Float32Array,
  projection: Projection,
  colors: SpeedTraceColors
) => {
  ctx.lineWidth = OWN_LINE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  let runColor: string | null = null;
  let runOpen = false;

  const closeRun = () => {
    if (runOpen) {
      ctx.stroke();
      runOpen = false;
    }

    runColor = null;
  };

  for (let index = 1; index < TRACE_POINT_COUNT; index++) {
    const previousValue = values[index - 1];
    const value = values[index];
    const previousOffsetM = buffers.offsetM[index - 1];
    const offsetM = buffers.offsetM[index];

    if (
      !isValue(previousValue) ||
      !isValue(value) ||
      !isValue(previousOffsetM) ||
      !isValue(offsetM)
    ) {
      closeRun();
      continue;
    }

    const color = deltaColor(buffers.timeDeltaS[index], colors);

    if (color !== runColor) {
      closeRun();

      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(projection.x(previousOffsetM), projection.y(previousValue));
      runColor = color;
      runOpen = true;
    }

    ctx.lineTo(projection.x(offsetM), projection.y(value));
  }

  closeRun();
};

/**
 * Dashed vertical at each braking point — where the pedal first went down. The
 * gap between the two is the metre figure the call row prints; the marks are
 * what let the driver see it rather than take it on trust. Full height, inset
 * top and bottom: a stub at the bottom edge disappeared under the trace exactly
 * where the two lines diverge, which is where it is needed.
 */
const drawBrakeMarks = (
  ctx: CanvasRenderingContext2D,
  stats: TraceWindowStats,
  projection: Projection,
  height: number,
  colors: SpeedTraceColors
) => {
  const inset = height * BRAKE_MARK_INSET_RATIO;

  ctx.save();
  ctx.lineWidth = BRAKE_MARK_WIDTH;
  ctx.globalAlpha = BRAKE_MARK_ALPHA;
  ctx.setLineDash(BRAKE_MARK_DASH);

  const drawMark = (offsetM: number | null, color: string) => {
    if (offsetM === null) return;

    const x = Math.round(projection.x(offsetM)) + 0.5;

    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, height - inset);
    ctx.lineTo(x, inset);
    ctx.stroke();
  };

  drawMark(stats.referenceBrakeOffsetM, colors.reference);

  // Braking later than the reference is what costs time, so this mark takes the
  // same colour the line does where the two diverge. With no reference mark in
  // the window there is nothing to be earlier or later than, and claiming a
  // gain or a loss there would be an invention — it stays neutral.
  const ownMarkColor =
    stats.brakeDeltaM === null
      ? colors.marker
      : stats.brakeDeltaM > 0
        ? colors.loss
        : colors.gain;

  drawMark(stats.ownBrakeOffsetM, ownMarkColor);

  ctx.restore();
};

/** Dashed line and dot at the car's current position — where the own trace ends. */
const drawNowMarker = (
  ctx: CanvasRenderingContext2D,
  buffers: TraceWindowBuffers,
  values: Float32Array,
  projection: Projection,
  height: number,
  colors: SpeedTraceColors
) => {
  const nowIndex = (TRACE_POINT_COUNT - 1) / 2;
  const offsetM = buffers.offsetM[nowIndex];

  if (!isValue(offsetM)) return;

  const x = Math.round(projection.x(offsetM)) + 0.5;

  ctx.save();
  ctx.setLineDash(NOW_DASH);
  ctx.strokeStyle = colors.marker;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.restore();

  const value = values[nowIndex];

  if (!isValue(value)) return;

  ctx.fillStyle = deltaColor(buffers.timeDeltaS[nowIndex], colors);
  ctx.beginPath();
  ctx.arc(x, projection.y(value), MARKER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
};

export const drawSpeedTrace = (
  canvas: HTMLCanvasElement,
  buffers: TraceWindowBuffers,
  stats: TraceWindowStats,
  channelName: CoachTraceChannel,
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

  if (!stats.hasData) return;

  const channel = channelFor(buffers, channelName);
  const projection = buildProjection(buffers, channel, width, height);

  if (!projection) return;

  drawReference(ctx, buffers, channel.reference, projection, colors.reference);
  drawOwnTrace(ctx, buffers, channel.own, projection, colors);
  drawBrakeMarks(ctx, stats, projection, height, colors);
  drawNowMarker(ctx, buffers, channel.own, projection, height, colors);
};
