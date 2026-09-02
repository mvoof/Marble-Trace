import { useRef, useCallback, useLayoutEffect, useContext } from 'react';

import { useReactiveCanvasLoop } from '@ui/hooks/useReactiveCanvasLoop';
import { resizeCanvasToDpr } from '@utils/canvas';
import {
  COLOR_TURN,
  ENVELOPE_SPREAD,
  FADING_DECAY,
  G_CONSTANT,
  RADIUS_RATIO,
  SMOOTHING,
  TRACE_LENGTH,
  computeColor,
} from '@ui/widgets/GMeterWidget/g-meter-utils';
import type { EnvelopePoint, TrailPoint } from '@ui/widgets/GMeterWidget/types';
import type { GMeterWidgetSettings } from '@/types/widget-settings';

import styles from './GMeterTrace.module.scss';
import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';

const BADGE_BASE_WIDTH_PX = 240;
const BADGE_FONT_SIZE_PX = 18;

interface AxisPeaks {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const drawDynamicAxisIndicator = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  canvasWidth: number,
  canvasHeight: number,
  centerAngle: number,
  isActive: boolean,
  activeColor: string,
  liveG: number,
  peakG: number,
  scale: number,
  rotAngle: number,
  fontSize: number,
  scaleRatio: number
) => {
  const displayVal = isActive ? liveG : peakG;
  const valStr = displayVal.toFixed(2);

  // Outer rim radius running right along the circular widget perimeter
  const rRim = Math.min(canvasWidth, canvasHeight) * 0.485;
  // Position text exactly in the middle between outer ring and widget rim
  const textR = (radius + rRim) / 2;

  ctx.font = `700 ${fontSize}px 'Rajdhani', sans-serif`;
  const textWidth = ctx.measureText(valStr).width;

  // Maximum arc half-sweep along the rim extends 5px beyond the edges of the digits
  const maxHalfSweep = (textWidth / 2 + 5 * scaleRatio) / rRim;
  const gRatio = Math.min(1, Math.max(0, displayVal / scale));

  // Dynamic arc on the rim: grows from 0 to the exact text block width as load increases
  if (isActive && gRatio > 0.01) {
    const sweep = gRatio * maxHalfSweep;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 4 * scaleRatio;
    ctx.beginPath();
    ctx.arc(cx, cy, rRim, centerAngle - sweep, centerAngle + sweep);
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Floating numeric text
  const tx = cx + Math.cos(centerAngle) * textR;
  const ty = cy + Math.sin(centerAngle) * textR;

  ctx.save();
  ctx.translate(tx, ty);
  if (rotAngle !== 0) {
    ctx.rotate(rotAngle);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isActive) {
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 4 * scaleRatio;
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = 'rgba(160, 165, 178, 0.75)';
  }

  ctx.fillText(valStr, 0, 0);
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
  const scaleRatio = (canvasWidth / BADGE_BASE_WIDTH_PX) * fontScale;
  const fontSize = Math.max(8, Math.round(BADGE_FONT_SIZE_PX * scaleRatio));

  // Top (Brake / Decel): active when lonG < -0.08
  const isTopActive = lonG < -0.08;
  drawDynamicAxisIndicator(
    ctx,
    cx,
    cy,
    radius,
    canvasWidth,
    canvasHeight,
    -Math.PI / 2,
    isTopActive,
    color,
    Math.abs(lonG),
    peaks.top,
    scale,
    0,
    fontSize,
    scaleRatio
  );

  // Bottom (Accel): active when lonG > 0.08
  const isBottomActive = lonG > 0.08;
  drawDynamicAxisIndicator(
    ctx,
    cx,
    cy,
    radius,
    canvasWidth,
    canvasHeight,
    Math.PI / 2,
    isBottomActive,
    color,
    lonG,
    peaks.bottom,
    scale,
    0,
    fontSize,
    scaleRatio
  );

  // Left (Left Turn): active when latG < -0.08
  const isLeftActive = latG < -0.08;
  drawDynamicAxisIndicator(
    ctx,
    cx,
    cy,
    radius,
    canvasWidth,
    canvasHeight,
    Math.PI,
    isLeftActive,
    color,
    Math.abs(latG),
    peaks.left,
    scale,
    -Math.PI / 2,
    fontSize,
    scaleRatio
  );

  // Right (Right Turn): active when latG > 0.08
  const isRightActive = latG > 0.08;
  drawDynamicAxisIndicator(
    ctx,
    cx,
    cy,
    radius,
    canvasWidth,
    canvasHeight,
    0,
    isRightActive,
    color,
    latG,
    peaks.right,
    scale,
    Math.PI / 2,
    fontSize,
    scaleRatio
  );
};

interface GMeterTraceProps {
  width: number;
  height: number;
}

// Not wrapped in observer() intentionally: useReactiveCanvasLoop subscribes to
// MobX observables directly, so React re-renders are not needed for data updates.
// observer() would cause 60 Hz React re-renders on every carDynamics change.
export const GMeterTrace = ({ width, height }: GMeterTraceProps) => {
  const widgetId = useContext(WidgetIdContext);
  const telemetry = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Synced on commit so the reactive loop always reads fresh props without an
  // effect restart. Writing this during render would break under React's
  // replayed/discarded renders.
  const dimsRef = useRef({ width, height });

  useLayoutEffect(() => {
    dimsRef.current = { width, height };
  }, [width, height]);

  const stateRef = useRef({
    smoothedLatG: 0,
    smoothedLonG: 0,
    peakTop: 0,
    peakBottom: 0,
    peakLeft: 0,
    peakRight: 0,
    gEnvelope: Array.from(
      { length: 360 },
      (): EnvelopePoint => ({ r: 0, color: COLOR_TURN })
    ),
    gHistory: [] as TrailPoint[],
    lastScale: -1,
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
      const dynamics = telemetry.carDynamics;
      const settings =
        widgetSettings.getSettings<GMeterWidgetSettings>(widgetId);
      const fontScale =
        widgetSettings.getWidget(widgetId)?.userSettings.fontScale ?? 1;
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

      state.smoothedLatG += (rawLat - state.smoothedLatG) * SMOOTHING;
      state.smoothedLonG += (rawLon - state.smoothedLonG) * SMOOTHING;

      let dist = Math.sqrt(state.smoothedLatG ** 2 + state.smoothedLonG ** 2);
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
        for (let index = 0; index < 360; index++) {
          state.gEnvelope[index].r *= FADING_DECAY;
        }
        state.peakTop *= FADING_DECAY;
        state.peakBottom *= FADING_DECAY;
        state.peakLeft *= FADING_DECAY;
        state.peakRight *= FADING_DECAY;
      }

      state.gHistory.push({
        lat: state.smoothedLatG,
        lon: state.smoothedLonG,
        color,
      });

      if (state.gHistory.length > TRACE_LENGTH) {
        state.gHistory.shift();
      }

      scheduleDraw(() => {
        drawTrace(canvas, settings, fontScale, color);
      });
    },
    [telemetry, widgetSettings, widgetId, drawTrace, width, height]
  );

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-label="G-meter trace"
    />
  );
};
