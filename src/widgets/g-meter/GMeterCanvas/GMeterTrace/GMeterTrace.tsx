import { observer } from 'mobx-react-lite';
import { useRef, useCallback, useLayoutEffect } from 'react';

import { useReactiveCanvasLoop } from '@shared/hooks/useReactiveCanvasLoop';
import { fillFixedDigits, resizeCanvasToDpr } from '@shared/lib/canvas';
import {
  COLOR_TURN,
  ENVELOPE_SPREAD,
  G_CONSTANT,
  RADIUS_RATIO,
  RIM_WIDTH_PX,
  TRACE_DURATION_MS,
  computeColor,
  rimRadiusOf,
  decayOver,
  smoothingOver,
  ticksElapsed,
} from '@widgets/g-meter/g-meter-utils';
import type { EnvelopePoint, TrailPoint } from '@widgets/g-meter/types';
import type { CarDynamicsFrame } from '@shared/contracts/generated/bindings';

import styles from './GMeterTrace.module.scss';
import { usePlayerStore } from '@entities/player/player-context';
import { useLiveWidgetsStore } from '@entities/layout/live-widgets-context';
import { useWidgetInstanceId } from '@entities/layout/useWidgetSettings';
import type { GMeterWidgetSettings } from '../../settings-schema';

const BADGE_BASE_WIDTH_PX = 240;
const BADGE_FONT_SIZE_PX = 18;

/** Below this load an axis reads as idle and shows its peak instead. */
const AXIS_ACTIVE_G = 0.08;

/**
 * How far the rim paint may sweep either side of its own axis, at full scale.
 * An eighth of a turn, so neighbouring axes meet at the diagonal at most and
 * never paint over each other.
 */
const RIM_PAINT_MAX_SWEEP = Math.PI / 4;

const ACTIVE_VALUE_COLOR = '#ffffff';
const IDLE_VALUE_COLOR = 'rgba(160, 165, 178, 0.75)';

interface AxisPeaks {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface AxisReading {
  /** Where the axis meets the rim, in canvas radians. */
  angle: number;
  /** The digits turn to run along the rim on the side axes. */
  rotation: number;
  /** The load along the axis, positive when it pulls that way. */
  liveG: number;
  peakG: number;
}

interface RimGeometry {
  cx: number;
  cy: number;
  rimRadius: number;
  textRadius: number;
  scale: number;
  color: string;
}

/**
 * One axis's reading: a solid stretch of the rim track centred on the axis, lengthening
 * with the load, and the number between the scale and the rim — live while the
 * axis is loaded, its peak in grey while it is not.
 */
const drawAxisReading = (
  ctx: CanvasRenderingContext2D,
  rim: RimGeometry,
  { angle, rotation, liveG, peakG }: AxisReading
) => {
  const isActive = liveG > AXIS_ACTIVE_G;
  const displayG = isActive ? liveG : peakG;

  if (isActive) {
    const loadRatio = Math.min(1, displayG / rim.scale);
    const halfSweep = loadRatio * RIM_PAINT_MAX_SWEEP;

    ctx.beginPath();
    ctx.arc(
      rim.cx,
      rim.cy,
      rim.rimRadius,
      angle - halfSweep,
      angle + halfSweep
    );
    ctx.lineWidth = RIM_WIDTH_PX;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = rim.color;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(
    rim.cx + Math.cos(angle) * rim.textRadius,
    rim.cy + Math.sin(angle) * rim.textRadius
  );

  if (rotation !== 0) {
    ctx.rotate(rotation);
  }

  ctx.fillStyle = isActive ? ACTIVE_VALUE_COLOR : IDLE_VALUE_COLOR;
  fillFixedDigits(ctx, displayG.toFixed(2), 0, 0);
  ctx.restore();
};

const drawAxisBadges = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  canvasWidth: number,
  canvasHeight: number,
  latG: number,
  lonG: number,
  peaks: AxisPeaks,
  scale: number,
  fontScale: number,
  color: string
) => {
  const widthRatio = canvasWidth / BADGE_BASE_WIDTH_PX;
  const fontSize = Math.max(
    8,
    Math.round(BADGE_FONT_SIZE_PX * widthRatio * fontScale)
  );
  const rimRadius = rimRadiusOf(canvasWidth, canvasHeight);
  const rim: RimGeometry = {
    cx,
    cy,
    rimRadius,
    // The numbers sit halfway between the outer scale ring and the rim.
    textRadius: (radius + rimRadius) / 2,
    scale,
    color,
  };

  ctx.font = `700 ${fontSize}px 'Rajdhani', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Braking pulls the dot up, acceleration down; the side axes read vertically.
  drawAxisReading(ctx, rim, {
    angle: -Math.PI / 2,
    rotation: 0,
    liveG: -lonG,
    peakG: peaks.top,
  });
  drawAxisReading(ctx, rim, {
    angle: Math.PI / 2,
    rotation: 0,
    liveG: lonG,
    peakG: peaks.bottom,
  });
  drawAxisReading(ctx, rim, {
    angle: Math.PI,
    rotation: -Math.PI / 2,
    liveG: -latG,
    peakG: peaks.left,
  });
  drawAxisReading(ctx, rim, {
    angle: 0,
    rotation: Math.PI / 2,
    liveG: latG,
    peakG: peaks.right,
  });
};

interface GMeterTraceProps {
  width: number;
  height: number;
}

interface MeterState {
  smoothedLatG: number;
  smoothedLonG: number;
  peakTop: number;
  peakBottom: number;
  peakLeft: number;
  peakRight: number;
  gEnvelope: EnvelopePoint[];
  gHistory: TrailPoint[];
  lastScale: number;
  lastDynamics: CarDynamicsFrame | null | undefined;
  lastFrameAt: number | null;
}

/**
 * Moves the meter on by one telemetry frame that covers `ticks` 60 Hz ticks:
 * the dot closes on the raw reading, the peaks and the envelope take it in,
 * the fading envelope decays and the trail gains a point and loses the ones
 * older than it reaches back.
 */
const advanceMeter = (
  state: MeterState,
  rawLat: number,
  rawLon: number,
  ticks: number,
  now: number,
  settings: GMeterWidgetSettings
): void => {
  const smoothing = smoothingOver(ticks);

  state.smoothedLatG += (rawLat - state.smoothedLatG) * smoothing;
  state.smoothedLonG += (rawLon - state.smoothedLonG) * smoothing;

  let dist = Math.hypot(state.smoothedLatG, state.smoothedLonG);
  const maxG = settings.scale;

  if (dist > maxG) {
    const ratio = maxG / dist;

    state.smoothedLatG *= ratio;
    state.smoothedLonG *= ratio;
    dist = maxG;
  }

  if (state.smoothedLonG < 0) {
    state.peakTop = Math.max(state.peakTop, Math.abs(state.smoothedLonG));
  }

  if (state.smoothedLonG > 0) {
    state.peakBottom = Math.max(state.peakBottom, state.smoothedLonG);
  }

  if (state.smoothedLatG < 0) {
    state.peakLeft = Math.max(state.peakLeft, Math.abs(state.smoothedLatG));
  }

  if (state.smoothedLatG > 0) {
    state.peakRight = Math.max(state.peakRight, state.smoothedLatG);
  }

  const color = computeColor(
    settings.colorMode,
    state.smoothedLatG,
    state.smoothedLonG,
    dist
  );

  const angle = Math.atan2(state.smoothedLonG, state.smoothedLatG);
  let degree = Math.round(angle * (180 / Math.PI));

  if (degree < 0) {
    degree += 360;
  }

  for (let delta = -ENVELOPE_SPREAD; delta <= ENVELOPE_SPREAD; delta++) {
    const idx = (degree + delta + 360) % 360;
    const smoothedR = dist * Math.cos((delta * Math.PI) / 180);

    if (smoothedR > state.gEnvelope[idx].r) {
      state.gEnvelope[idx].r = smoothedR;
      state.gEnvelope[idx].color = color;
    }
  }

  if (settings.displayMode === 'fading') {
    const decay = decayOver(ticks);

    for (let index = 0; index < 360; index++) {
      state.gEnvelope[index].r *= decay;
    }

    state.peakTop *= decay;
    state.peakBottom *= decay;
    state.peakLeft *= decay;
    state.peakRight *= decay;
  }

  state.gHistory.push({
    lat: state.smoothedLatG,
    lon: state.smoothedLonG,
    color,
    atMs: now,
  });

  while (
    state.gHistory.length > 0 &&
    now - state.gHistory[0].atMs > TRACE_DURATION_MS
  ) {
    state.gHistory.shift();
  }
};

export const GMeterTrace = observer(({ width, height }: GMeterTraceProps) => {
  const widgetId = useWidgetInstanceId('g-meter');
  const telemetry = usePlayerStore();
  const liveWidgets = useLiveWidgetsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Synced on commit so the reactive loop always reads fresh props without an
  // effect restart. Writing this during render would break under React's
  // replayed/discarded renders.
  const dimsRef = useRef({ width, height });

  useLayoutEffect(() => {
    dimsRef.current = { width, height };
  }, [width, height]);

  const stateRef = useRef<MeterState>({
    smoothedLatG: 0,
    smoothedLonG: 0,
    peakTop: 0,
    peakBottom: 0,
    peakLeft: 0,
    peakRight: 0,
    gEnvelope: Array.from({ length: 360 }, (): EnvelopePoint => ({
      r: 0,
      color: COLOR_TURN,
    })),
    gHistory: [],
    lastScale: -1,
    // The frame the state last advanced on, and when: the loop also re-runs on
    // a settings edit, which must repaint without counting as time or a point.
    lastDynamics: undefined,
    lastFrameAt: null,
  });

  const drawTrace = useCallback(
    (
      canvas: HTMLCanvasElement,
      settings: GMeterWidgetSettings,
      fontScale: number,
      color: string
    ) => {
      const mode = settings.displayMode;
      const scale = settings.scale;
      const { width: currentWidth, height: currentHeight } = dimsRef.current;
      const ctx = resizeCanvasToDpr(canvas, currentWidth, currentHeight);

      if (!ctx) return;

      const cx = currentWidth / 2;
      const cy = currentHeight / 2;
      const radius = Math.min(currentWidth, currentHeight) * RADIUS_RATIO * 0.5;
      const pxPerG = radius / scale;
      const state = stateRef.current;

      ctx.clearRect(0, 0, currentWidth, currentHeight);

      const envelope = state.gEnvelope;

      if (mode === 'trail') {
        if (state.gHistory.length >= 2) {
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = 2;

          for (let index = 1; index < state.gHistory.length; index++) {
            const previousPoint = state.gHistory[index - 1];
            const currentPoint = state.gHistory[index];

            ctx.beginPath();

            ctx.moveTo(
              cx + previousPoint.lat * pxPerG,
              cy + previousPoint.lon * pxPerG
            );

            ctx.lineTo(
              cx + currentPoint.lat * pxPerG,
              cy + currentPoint.lon * pxPerG
            );

            ctx.globalAlpha = index / state.gHistory.length;
            ctx.strokeStyle = currentPoint.color;
            ctx.stroke();
          }

          ctx.globalAlpha = 1.0;
        }
      } else {
        ctx.globalAlpha = 0.15;

        for (let index = 0; index < 360; index++) {
          const nextIndex = (index + 1) % 360;
          const r1 = envelope[index].r * pxPerG;
          const r2 = envelope[nextIndex].r * pxPerG;

          if (r1 > 0 || r2 > 0) {
            const rad1 = index * (Math.PI / 180);
            const rad2 = nextIndex * (Math.PI / 180);

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + r1 * Math.cos(rad1), cy + r1 * Math.sin(rad1));
            ctx.lineTo(cx + r2 * Math.cos(rad2), cy + r2 * Math.sin(rad2));
            ctx.closePath();

            ctx.fillStyle = envelope[index].color;
            ctx.fill();
          }
        }

        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';

        for (let index = 0; index < 360; index++) {
          const nextIndex = (index + 1) % 360;
          const r1 = envelope[index].r * pxPerG;
          const r2 = envelope[nextIndex].r * pxPerG;

          if (r1 > 0 || r2 > 0) {
            const rad1 = index * (Math.PI / 180);
            const rad2 = nextIndex * (Math.PI / 180);

            ctx.beginPath();
            ctx.moveTo(cx + r1 * Math.cos(rad1), cy + r1 * Math.sin(rad1));
            ctx.lineTo(cx + r2 * Math.cos(rad2), cy + r2 * Math.sin(rad2));
            ctx.strokeStyle = envelope[index].color;
            ctx.stroke();
          }
        }
      }

      const dotX = cx + state.smoothedLatG * pxPerG;
      const dotY = cy + state.smoothedLonG * pxPerG;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle =
        state.gHistory.length > 0
          ? (state.gHistory[state.gHistory.length - 1]?.color ?? COLOR_TURN)
          : COLOR_TURN;
      ctx.fill();

      drawAxisBadges(
        ctx,
        cx,
        cy,
        radius,
        currentWidth,
        currentHeight,
        state.smoothedLatG,
        state.smoothedLonG,
        {
          top: state.peakTop,
          bottom: state.peakBottom,
          left: state.peakLeft,
          right: state.peakRight,
        },
        scale,
        fontScale,
        color
      );
    },
    []
  );

  useReactiveCanvasLoop(
    (scheduleDraw) => {
      // oxlint-disable-next-line no-restricted-properties
      const dynamics = telemetry.carDynamics;
      const settings = liveWidgets.getSettings<GMeterWidgetSettings>(widgetId);
      const fontScale =
        liveWidgets.getWidget(widgetId)?.userSettings.fontScale ?? 1;
      const canvas = canvasRef.current;

      if (!canvas) return;

      const state = stateRef.current;

      const rawLat = (dynamics?.lat_accel ?? 0) / G_CONSTANT;
      const rawLon = (dynamics?.long_accel ?? 0) / G_CONSTANT;

      if (state.lastScale !== -1 && state.lastScale !== settings.scale) {
        state.gEnvelope = Array.from({ length: 360 }, () => ({
          r: 0,
          color: COLOR_TURN,
        }));
        state.gHistory = [];
        state.smoothedLatG = 0;
        state.smoothedLonG = 0;
        state.peakTop = 0;
        state.peakBottom = 0;
        state.peakLeft = 0;
        state.peakRight = 0;
      }

      state.lastScale = settings.scale;

      // The state advances once per telemetry frame, by the time that frame
      // covers. The loop also re-runs on a settings edit, which only repaints:
      // advancing there too added a point and a step of smoothing for nothing.
      if (dynamics !== state.lastDynamics) {
        const now = performance.now();
        const ticks =
          state.lastFrameAt === null
            ? 1
            : ticksElapsed(now - state.lastFrameAt);

        state.lastDynamics = dynamics;
        state.lastFrameAt = now;
        advanceMeter(state, rawLat, rawLon, ticks, now, settings);
      }

      const color = computeColor(
        settings.colorMode,
        state.smoothedLatG,
        state.smoothedLonG,
        Math.hypot(state.smoothedLatG, state.smoothedLonG)
      );

      scheduleDraw(() => {
        drawTrace(canvas, settings, fontScale, color);
      });
    },
    [telemetry, liveWidgets, widgetId, drawTrace, width, height]
  );

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-label="G-meter trace"
    />
  );
});
