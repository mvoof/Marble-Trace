import type { InputTraceSettings } from '@/types/widget-settings';
import { normalizedSteering } from '@utils/car-signals';

// Circular sample buffers shared by the ingest and paint passes. Channel
// samples are interleaved: buffer[sampleIndex * channelCount + channelIndex].
export interface TraceBufferState {
  buffer: Float32Array;
  absBuffer: Uint8Array;
  steerBuffer: Float32Array;
  head: number;
  count: number;
}

export const createTraceBufferState = (): TraceBufferState => ({
  buffer: new Float32Array(0),
  absBuffer: new Uint8Array(0),
  steerBuffer: new Float32Array(0),
  head: 0,
  count: 0,
});

const SAMPLES_PER_SECOND = 60;
const GRID_LINE_COUNT = 3;
const GRID_LINE_COLOR = 'rgba(255, 255, 255, 0.06)';
const STEERING_LINE_COLOR = 'rgba(255, 255, 255, 0.7)';

type TraceChannel = { color: string; type: 'throttle' | 'brake' | 'clutch' };

export const bufferSizeFor = (settings: InputTraceSettings): number =>
  settings.historySeconds * SAMPLES_PER_SECOND;

const visibleChannels = (settings: InputTraceSettings): TraceChannel[] => {
  const channels: TraceChannel[] = [];

  if (settings.showThrottle) {
    channels.push({ color: settings.throttleColor, type: 'throttle' });
  }

  if (settings.showBrake) {
    channels.push({ color: settings.brakeColor, type: 'brake' });
  }

  if (settings.showClutch) {
    channels.push({ color: settings.clutchColor, type: 'clutch' });
  }

  return channels;
};

const drawGrid = (
  ctx: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number
) => {
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let gridIndex = 1; gridIndex <= GRID_LINE_COUNT; gridIndex++) {
    const yPos = logicalHeight * (gridIndex / (GRID_LINE_COUNT + 1));

    ctx.moveTo(0, yPos);
    ctx.lineTo(logicalWidth, yPos);
  }

  ctx.stroke();
};

interface ChannelPassContext {
  ctx: CanvasRenderingContext2D;
  state: TraceBufferState;
  settings: InputTraceSettings;
  steeringLockDeg: number;
  logicalWidth: number;
  logicalHeight: number;
  channelCount: number;
  bufferSize: number;
}

const sampleAt = (
  { state, bufferSize }: ChannelPassContext,
  sampleIndex: number
): number => (state.head - state.count + sampleIndex + bufferSize) % bufferSize;

// The brake trace re-strokes whenever ABS engages or releases so the active
// segments can carry the ABS colour without breaking the line's continuity.
const drawBrakeChannel = (
  pass: ChannelPassContext,
  channelIndex: number,
  verticalInset: number,
  drawableHeight: number
) => {
  const { ctx, state, settings, logicalWidth, channelCount } = pass;

  let currentAbs = false;
  let started = false;

  ctx.strokeStyle = settings.brakeColor;
  ctx.beginPath();

  for (let sampleIndex = 0; sampleIndex < state.count; sampleIndex++) {
    const circularIndex = sampleAt(pass, sampleIndex);
    const sampleValue =
      state.buffer[circularIndex * channelCount + channelIndex];

    const xPos = (sampleIndex / (pass.bufferSize - 1)) * logicalWidth;
    const yPos = verticalInset + (1 - sampleValue) * drawableHeight;

    const sampleAbs = state.absBuffer[circularIndex] === 1;

    if (started && sampleAbs !== currentAbs) {
      ctx.lineTo(xPos, yPos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(xPos, yPos);
      ctx.strokeStyle = sampleAbs ? settings.absColor : settings.brakeColor;
      currentAbs = sampleAbs;
    }

    if (!started) {
      ctx.strokeStyle = sampleAbs ? settings.absColor : settings.brakeColor;
      currentAbs = sampleAbs;
      ctx.moveTo(xPos, yPos);
      started = true;
    } else {
      ctx.lineTo(xPos, yPos);
    }
  }

  ctx.stroke();
};

const drawPlainChannel = (
  pass: ChannelPassContext,
  channel: TraceChannel,
  channelIndex: number,
  verticalInset: number,
  drawableHeight: number
) => {
  const { ctx, state, logicalWidth, channelCount } = pass;

  ctx.strokeStyle = channel.color;
  ctx.beginPath();

  let started = false;

  for (let sampleIndex = 0; sampleIndex < state.count; sampleIndex++) {
    const circularIndex = sampleAt(pass, sampleIndex);
    const sampleValue =
      state.buffer[circularIndex * channelCount + channelIndex];

    const xPos = (sampleIndex / (pass.bufferSize - 1)) * logicalWidth;
    const yPos = verticalInset + (1 - sampleValue) * drawableHeight;

    if (!started) {
      ctx.moveTo(xPos, yPos);
      started = true;
    } else {
      ctx.lineTo(xPos, yPos);
    }
  }

  ctx.stroke();
};

const drawSteering = (pass: ChannelPassContext) => {
  const { ctx, state, settings, steeringLockDeg, logicalWidth, logicalHeight } =
    pass;

  ctx.strokeStyle = STEERING_LINE_COLOR;
  ctx.lineWidth = settings.lineWidth;
  ctx.beginPath();

  const verticalInset = settings.lineWidth / 2;
  const drawableHalfHeight = logicalHeight / 2 - verticalInset;

  let started = false;

  for (let sampleIndex = 0; sampleIndex < state.count; sampleIndex++) {
    const circularIndex = sampleAt(pass, sampleIndex);
    const rawSteer = state.steerBuffer[circularIndex] ?? 0;
    const normalized = normalizedSteering(
      rawSteer,
      steeringLockDeg,
      settings.steeringZoom ?? 1
    );

    const xPos = (sampleIndex / (pass.bufferSize - 1)) * logicalWidth;
    const yPos = logicalHeight / 2 - normalized * drawableHalfHeight;

    if (!started) {
      ctx.moveTo(xPos, yPos);
      started = true;
    } else {
      ctx.lineTo(xPos, yPos);
    }
  }

  ctx.stroke();
};

export const drawInputTrace = (
  canvas: HTMLCanvasElement,
  state: TraceBufferState,
  settings: InputTraceSettings,
  steeringLockDeg: number
) => {
  if (state.buffer.length === 0 && !settings.showSteering) return;

  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;
  const channels = visibleChannels(settings);

  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  drawGrid(ctx, logicalWidth, logicalHeight);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const pass: ChannelPassContext = {
    ctx,
    state,
    settings,
    steeringLockDeg,
    logicalWidth,
    logicalHeight,
    channelCount: channels.length,
    bufferSize: bufferSizeFor(settings),
  };

  for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
    const channel = channels[channelIndex];

    ctx.lineWidth = settings.lineWidth;

    const verticalInset = settings.lineWidth / 2;
    const drawableHeight = logicalHeight - verticalInset * 2;

    if (channel.type === 'brake') {
      drawBrakeChannel(pass, channelIndex, verticalInset, drawableHeight);
    } else {
      drawPlainChannel(
        pass,
        channel,
        channelIndex,
        verticalInset,
        drawableHeight
      );
    }
  }

  if (settings.showSteering) {
    drawSteering(pass);
  }
};

interface TraceSample {
  throttle: number;
  brake: number;
  clutch: number;
  absActive: boolean;
  steeringWheelAngle: number;
}

// Resizes the circular buffers when the settings change. Split out from
// pushTraceSample so a repaint that appends nothing (settings edit, static
// preview) still allocates the buffers and paints the grid. Mutates `state` in
// place — it is per-instance scratch space.
export const ensureTraceBuffers = (
  state: TraceBufferState,
  settings: InputTraceSettings
) => {
  const bufferSize = bufferSizeFor(settings);
  const channelCount =
    (settings.showThrottle ? 1 : 0) +
    (settings.showBrake ? 1 : 0) +
    (settings.showClutch ? 1 : 0);

  const requiredBufferLength = bufferSize * channelCount;

  // A resize of any circular buffer invalidates head/count for all of them —
  // e.g. with every channel toggled off, requiredBufferLength stays 0 across a
  // historySeconds change, but absBuffer/steerBuffer still get reallocated to
  // the new (smaller) bufferSize; leaving a stale head from the old size would
  // write out of bounds on them.
  let buffersResized = false;

  if (state.buffer.length !== requiredBufferLength) {
    state.buffer = new Float32Array(requiredBufferLength);
    buffersResized = true;
  }

  if (state.absBuffer.length !== bufferSize) {
    state.absBuffer = new Uint8Array(bufferSize);
    buffersResized = true;
  }

  if (state.steerBuffer.length !== bufferSize) {
    state.steerBuffer = new Float32Array(bufferSize);
    buffersResized = true;
  }

  if (buffersResized) {
    state.head = 0;
    state.count = 0;
  }
};

// Appends exactly one sample. Channel values arrive already smoothed by
// InputTraceWidgetStore, so the trace and the bars never drift apart. Must be
// called at most once per telemetry frame: the buffer length encodes
// `historySeconds` at 60 samples per second, so an extra push per frame
// shortens the visible history proportionally.
export const pushTraceSample = (
  state: TraceBufferState,
  sample: TraceSample,
  settings: InputTraceSettings
) => {
  const bufferSize = bufferSizeFor(settings);

  if (bufferSize === 0) return;

  const values: number[] = [];

  if (settings.showThrottle) values.push(sample.throttle);

  if (settings.showBrake) values.push(sample.brake);

  if (settings.showClutch) values.push(sample.clutch);

  const offset = state.head * values.length;

  for (let channelIndex = 0; channelIndex < values.length; channelIndex++) {
    state.buffer[offset + channelIndex] = values[channelIndex] ?? 0;
  }

  state.absBuffer[state.head] = sample.absActive ? 1 : 0;
  state.steerBuffer[state.head] = sample.steeringWheelAngle;

  state.head = (state.head + 1) % bufferSize;

  if (state.count < bufferSize) {
    state.count++;
  }
};
