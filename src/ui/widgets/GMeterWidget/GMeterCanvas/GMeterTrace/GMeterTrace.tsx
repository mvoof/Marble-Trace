import { useRef, useCallback, useLayoutEffect } from 'react';

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

const BADGE_BASE_WIDTH_PX = 240;
const BADGE_FONT_SIZE_PX = 12;
const BADGE_PILL_W_PX = 38;
const BADGE_PILL_H_PX = 18;
const BADGE_CORNER_R_PX = 4;

interface AxisPeaks {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const drawStyledBadge = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  isActive: boolean,
  activeColor: string,
  text: string,
  rotateRad: number,
  pipOnBottom: boolean,
  fontSize: number
) => {
  ctx.save();
  ctx.translate(x, y);

  if (rotateRad !== 0) {
    ctx.rotate(rotateRad);
  }

  const halfW = w / 2;
  const halfH = h / 2;

  // Active glow
  if (isActive) {
    ctx.save();
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-halfW, -halfH, w, h, r);
    } else {
      ctx.rect(-halfW, -halfH, w, h);
    }
    ctx.fillStyle = activeColor;
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.restore();
  }

  // Dark plate background
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-halfW, -halfH, w, h, r);
  } else {
    ctx.rect(-halfW, -halfH, w, h);
  }
  ctx.fillStyle = isActive
    ? 'rgba(12, 14, 18, 0.96)'
    : 'rgba(18, 20, 26, 0.88)';
  ctx.fill();

  // Border outline
  ctx.lineWidth = isActive ? 1.5 : 1;
  ctx.strokeStyle = isActive ? activeColor : 'rgba(75, 80, 92, 0.5)';
  ctx.stroke();

  // Outer accent bar / pip
  const pipW = Math.round(w * 0.5);
  const pipH = 2.5;
  const pipY = pipOnBottom ? halfH - pipH : -halfH;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-pipW / 2, pipY, pipW, pipH, 1);
  } else {
    ctx.rect(-pipW / 2, pipY, pipW, pipH);
  }
  ctx.fillStyle = isActive ? activeColor : 'rgba(90, 95, 108, 0.5)';
  ctx.fill();

  // Typography
  ctx.font = `700 ${fontSize}px 'Rajdhani', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isActive ? '#ffffff' : 'rgba(175, 180, 192, 0.85)';
  ctx.fillText(text, 0, pipOnBottom ? -1 : 1);

  ctx.restore();
};

const drawAxisBadges = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  canvasWidth: number,
  latG: number,
  lonG: number,
  peaks: AxisPeaks,
  color: string
) => {
  const scaleRatio = canvasWidth / BADGE_BASE_WIDTH_PX;
  const fontSize = Math.max(10, Math.round(BADGE_FONT_SIZE_PX * scaleRatio));
  const pillW = Math.round(BADGE_PILL_W_PX * scaleRatio);
  const pillH = Math.round(BADGE_PILL_H_PX * scaleRatio);
  const pillR = Math.max(2, Math.round(BADGE_CORNER_R_PX * scaleRatio));
  const badgeDist = radius * 1.14;

  // Top (Brake / Decel): active when lonG < -0.08
  const isTopActive = lonG < -0.08;
  const topVal = isTopActive ? Math.abs(lonG) : peaks.top;
  drawStyledBadge(
    ctx,
    cx,
    cy - badgeDist,
    pillW,
    pillH,
    pillR,
    isTopActive,
    color,
    topVal.toFixed(2),
    0,
    false,
    fontSize
  );

  // Bottom (Accel): active when lonG > 0.08
  const isBottomActive = lonG > 0.08;
  const bottomVal = isBottomActive ? lonG : peaks.bottom;
  drawStyledBadge(
    ctx,
    cx,
    cy + badgeDist,
    pillW,
    pillH,
    pillR,
    isBottomActive,
    color,
    bottomVal.toFixed(2),
    0,
    true,
    fontSize
  );

  // Left (Left Turn): active when latG < -0.08
  const isLeftActive = latG < -0.08;
  const leftVal = isLeftActive ? Math.abs(latG) : peaks.left;
  drawStyledBadge(
    ctx,
    cx - badgeDist,
    cy,
    pillW,
    pillH,
    pillR,
    isLeftActive,
    color,
    leftVal.toFixed(2),
    -Math.PI / 2,
    false,
    fontSize
  );

  // Right (Right Turn): active when latG > 0.08
  const isRightActive = latG > 0.08;
  const rightVal = isRightActive ? latG : peaks.right;
  drawStyledBadge(
    ctx,
    cx + badgeDist,
    cy,
    pillW,
    pillH,
    pillR,
    isRightActive,
    color,
    rightVal.toFixed(2),
    Math.PI / 2,
    false,
    fontSize
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
        state.smoothedLatG,
        state.smoothedLonG,
        {
          top: state.peakTop,
          bottom: state.peakBottom,
          left: state.peakLeft,
          right: state.peakRight,
        },
        color
      );
    },
    []
  );

  useReactiveCanvasLoop(
    (scheduleDraw) => {
      const dynamics = telemetry.carDynamics;
      const settings =
        widgetSettings.getSettings<GMeterWidgetSettings>('g-meter');
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
        drawTrace(canvas, settings, color);
      });
    },
    [telemetry, widgetSettings, drawTrace, width, height]
  );

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-label="G-meter trace"
    />
  );
};
