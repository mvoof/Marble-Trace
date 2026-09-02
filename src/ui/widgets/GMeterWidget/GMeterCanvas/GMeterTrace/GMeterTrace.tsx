import { useRef, useCallback, useLayoutEffect } from 'react';

import { useReactiveCanvasLoop } from '@ui/hooks/useReactiveCanvasLoop';
import { resizeCanvasToDpr } from '@utils/canvas';
import {
  COLOR_OVERLOAD,
  COLOR_TURN,
  ENVELOPE_SPREAD,
  FADING_DECAY,
  G_CONSTANT,
  RADIUS_RATIO,
  OUTER_ARC_CENTERS,
  OUTER_ARC_HALF_SWEEP,
  OUTER_ARC_RADIUS_RATIO,
  QUADRANT_VALUE_RADIUS_RATIO,
  SMOOTHING,
  TRACE_LENGTH,
  computeColor,
  computeOverload,
  quadrantDiagonal,
} from '@ui/widgets/GMeterWidget/g-meter-utils';
import type { EnvelopePoint, TrailPoint } from '@ui/widgets/GMeterWidget/types';
import type { GMeterWidgetSettings } from '@/types/widget-settings';

import styles from './GMeterTrace.module.scss';
import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const QUADRANT_TINT_ALPHA = 0.07;
const OVERLOAD_ARC_WIDTH_PX = 3;
const VALUE_BASE_WIDTH_PX = 240;
const VALUE_BASE_SIZE_PX = 15;

// The lit quadrant is cut off by the outer ring: the plate is a circle, so a
// square wash would run past the rim the widget is clipped to.
const drawQuadrantTint = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  latG: number,
  lonG: number,
  color: string
) => {
  const { dx, dy } = quadrantDiagonal(latG, lonG);
  const start = Math.atan2(dy, dx) - Math.PI / 4;

  ctx.save();
  ctx.globalAlpha = QUADRANT_TINT_ALPHA;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, start, start + Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

// Past the outer ring the dot is clamped, so the arcs carry the news: the load
// no longer fits the chosen scale.
const drawOverloadArcs = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  overload: number
) => {
  if (overload <= 0) return;

  const arcRadius = radius * OUTER_ARC_RADIUS_RATIO;

  ctx.save();
  ctx.globalAlpha = 0.4 + overload * 0.6;
  ctx.strokeStyle = COLOR_OVERLOAD;
  ctx.lineWidth = OVERLOAD_ARC_WIDTH_PX;
  ctx.lineCap = 'round';

  OUTER_ARC_CENTERS.forEach((center) => {
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      arcRadius,
      center - OUTER_ARC_HALF_SWEEP,
      center + OUTER_ARC_HALF_SWEEP
    );
    ctx.stroke();
  });

  ctx.restore();
};

const drawQuadrantValues = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  canvasWidth: number,
  latG: number,
  lonG: number,
  color: string
) => {
  const { dx, dy } = quadrantDiagonal(latG, lonG);
  const distance = radius * QUADRANT_VALUE_RADIUS_RATIO;
  const fontSize = Math.round(
    VALUE_BASE_SIZE_PX * (canvasWidth / VALUE_BASE_WIDTH_PX)
  );

  ctx.save();
  ctx.font = `500 ${fontSize}px 'Consolas', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(
    `${Math.abs(latG).toFixed(2)} / ${Math.abs(lonG).toFixed(2)}`,
    cx + dx * distance,
    cy + dy * distance
  );
  ctx.restore();
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
      color: string,
      overload: number
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

      if (settings.showQuadrantTint !== false) {
        drawQuadrantTint(
          ctx,
          cx,
          cy,
          radius,
          state.smoothedLatG,
          state.smoothedLonG,
          color
        );
      }

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

      drawOverloadArcs(ctx, cx, cy, radius, overload);

      if (settings.showValues !== false) {
        drawQuadrantValues(
          ctx,
          cx,
          cy,
          radius,
          currentWidth,
          state.smoothedLatG,
          state.smoothedLonG,
          color
        );
      }
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
      }

      state.lastScale = settings.scale;

      state.smoothedLatG += (rawLat - state.smoothedLatG) * SMOOTHING;
      state.smoothedLonG += (rawLon - state.smoothedLonG) * SMOOTHING;

      let dist = Math.sqrt(state.smoothedLatG ** 2 + state.smoothedLonG ** 2);
      const rawDist = dist;
      const maxG = settings.scale;

      if (dist > maxG) {
        const ratio = maxG / dist;

        state.smoothedLatG *= ratio;
        state.smoothedLonG *= ratio;
        dist = maxG;
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
      }

      state.gHistory.push({
        lat: state.smoothedLatG,
        lon: state.smoothedLonG,
        color,
      });

      if (state.gHistory.length > TRACE_LENGTH) {
        state.gHistory.shift();
      }

      const overload = computeOverload(rawDist, settings.scale);

      scheduleDraw(() => {
        drawTrace(canvas, settings, color, overload);
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
