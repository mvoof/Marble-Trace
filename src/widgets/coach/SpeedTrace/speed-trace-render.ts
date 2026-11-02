import {
  traceValueRange,
  TRACE_POINT_COUNT,
  windowIndexAt,
  type CornerPhases,
  type TraceWindowBuffers,
  type TraceWindowStats,
} from '@widgets/coach/coach-trace-utils';
import type { CoachTraceChannel } from '../settings-schema';

export interface SpeedTraceColors {
  reference: string;
  gain: string;
  loss: string;
  grid: string;
  marker: string;
  /** The braking zone, its marks and the BRAKE figure. */
  brake: string;
  /** The stretch off the brakes and through the apex. */
  apex: string;
  /** The exit, from the throttle point to full throttle. */
  throttle: string;
}

/** Horizontal grid lines drawn behind the traces — dashed, as on the input trace. */
const GRID_LINE_COUNT = 3;
const GRID_LINE_WIDTH = 0.75;
const GRID_LINE_DASH: [number, number] = [2, 4];
/** A phase zone is a tint, not a fill: the traces drawn over it must stay the loudest thing. */
const PHASE_FILL_ALPHA = 0.1;
/** The 1 px edges that say where each phase of the reference begins and ends. */
const PHASE_EDGE_ALPHA = 0.45;
/** Share of the value range added above and below so the curves never touch the edges. */
const RANGE_PADDING = 0.12;
/** Speed range (m/s) forced open when both traces are nearly flat, so a straight does not amplify noise. */
const MIN_SPEED_RANGE_MPS = 5;
const REFERENCE_LINE_WIDTH = 1.75;
const OWN_LINE_WIDTH = 2.25;
const PHASE_MARK_WIDTH = 1.25;
const MARKER_RADIUS = 2.75;
/** This lap's phase points — larger than the "now" dot, which they must not be confused with. */
const PHASE_DOT_RADIUS = 3.25;
const NOW_DASH: [number, number] = [3, 3];
const PHASE_MARK_DASH: [number, number] = [3, 3];
/** Phase marks are drawn dimmer than the lines they belong to — they mark a point, they are not a signal of their own. */
const PHASE_MARK_ALPHA = 0.7;
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
  /** Whether the traces are speed — the channel the apex is a point on. */
  isSpeed: boolean;
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
        isSpeed: false,
        // Pedal travel is already 0-1 and its absolute level is the point —
        // autoscaling would make a feather-light brush of the pedal look like
        // a full stop.
        fixedRange: { min: 0, max: 1 },
      }
    : {
        reference: buffers.referenceSpeed,
        own: buffers.ownSpeed,
        isSpeed: true,
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
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = GRID_LINE_WIDTH;
  ctx.setLineDash(GRID_LINE_DASH);
  ctx.beginPath();

  for (let index = 1; index <= GRID_LINE_COUNT; index++) {
    const y = Math.round((height / (GRID_LINE_COUNT + 1)) * index) + 0.5;

    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  ctx.stroke();
  ctx.restore();
};

/**
 * The reference's corner, shaded by phase: on the brakes, through the apex, on
 * the way back to full throttle. Each zone is a faint tint with a 1 px edge on
 * either side, so the length of a phase reads at a glance and this lap's
 * points, drawn over it, read as early or late against the zone they fall in.
 * A phase that runs off the window is drawn to the edge.
 */
const drawPhaseZones = (
  ctx: CanvasRenderingContext2D,
  phases: CornerPhases,
  projection: Projection,
  width: number,
  height: number,
  colors: SpeedTraceColors
) => {
  const drawZone = (
    startM: number | null,
    endM: number | null,
    color: string
  ) => {
    if (startM === null) return;

    const left = Math.round(projection.x(startM));
    const right = endM === null ? width : Math.round(projection.x(endM));

    if (right <= left) return;

    ctx.fillStyle = color;
    ctx.globalAlpha = PHASE_FILL_ALPHA;
    ctx.fillRect(left, 0, right - left, height);

    ctx.globalAlpha = PHASE_EDGE_ALPHA;
    ctx.fillRect(left, 0, 1, height);
    ctx.fillRect(right - 1, 0, 1, height);
  };

  ctx.save();
  drawZone(phases.brakeZoneStartM, phases.brakeReleaseM, colors.brake);
  drawZone(phases.brakeReleaseM, phases.throttlePointM, colors.apex);
  drawZone(phases.throttlePointM, phases.fullThrottleM, colors.throttle);
  ctx.restore();
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

/** The trace's value at a point of the window, or null where it has none. */
const valueAt = (
  buffers: TraceWindowBuffers,
  values: Float32Array,
  offsetM: number
): number | null => {
  const position = windowIndexAt(buffers.offsetM, offsetM);

  if (!isValue(position)) return null;

  const value = values[Math.round(position)];

  return isValue(value) ? value : null;
};

/**
 * Where the reference brakes, bottoms out and opens the throttle, and where
 * this lap did. The reference's points are dashed verticals — full height at
 * the braking and throttle points, and at the apex from the speed curve down,
 * so it does not cut through the line where the two traces meet. The apex is
 * the lowest speed, so on a pedal channel it has no point on the curve and is
 * drawn full height too. This lap's are dots on its own line; the gap between
 * a dot and its line is how much earlier or later this lap got there.
 */
const drawPhaseMarks = (
  ctx: CanvasRenderingContext2D,
  buffers: TraceWindowBuffers,
  channel: Channel,
  stats: TraceWindowStats,
  projection: Projection,
  height: number,
  colors: SpeedTraceColors
) => {
  const drawLine = (
    offsetM: number | null,
    fullHeight: boolean,
    color: string
  ) => {
    if (offsetM === null) return;

    const value = valueAt(buffers, channel.reference, offsetM);
    const top = fullHeight || value === null ? 0 : projection.y(value);
    const x = Math.round(projection.x(offsetM)) + 0.5;

    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x, top);
    ctx.stroke();
  };

  ctx.save();
  ctx.lineWidth = PHASE_MARK_WIDTH;
  ctx.globalAlpha = PHASE_MARK_ALPHA;
  ctx.setLineDash(PHASE_MARK_DASH);

  drawLine(stats.reference.brakePointM, true, colors.brake);
  drawLine(stats.reference.apexM, !channel.isSpeed, colors.apex);
  drawLine(stats.reference.throttlePointM, true, colors.throttle);

  ctx.restore();

  const drawDot = (offsetM: number | null, color: string) => {
    if (offsetM === null) return;

    const value = valueAt(buffers, channel.own, offsetM);

    if (value === null) return;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
      projection.x(offsetM),
      projection.y(value),
      PHASE_DOT_RADIUS,
      0,
      Math.PI * 2
    );
    ctx.fill();
  };

  drawDot(stats.own.brakePointM, colors.brake);
  drawDot(stats.own.apexM, colors.apex);
  drawDot(stats.own.throttlePointM, colors.throttle);
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

  const channel = channelFor(buffers, channelName);
  const projection = stats.hasData
    ? buildProjection(buffers, channel, width, height)
    : null;

  // The zones go under the grid so the dashes stay visible through the tint.
  if (projection) {
    drawPhaseZones(ctx, stats.reference, projection, width, height, colors);
  }

  drawGrid(ctx, width, height, colors.grid);

  if (!projection) return;

  drawReference(ctx, buffers, channel.reference, projection, colors.reference);
  drawOwnTrace(ctx, buffers, channel.own, projection, colors);
  drawPhaseMarks(ctx, buffers, channel, stats, projection, height, colors);
  drawNowMarker(ctx, buffers, channel.own, projection, height, colors);
};
