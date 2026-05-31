import { useEffect, useRef, useCallback } from 'react';
import { autorun } from 'mobx';

import {
  COLOR_TURN,
  ENVELOPE_SPREAD,
  FADING_DECAY,
  G_CONSTANT,
  RADIUS_RATIO,
  SMOOTHING,
  TRACE_LENGTH,
  computeColor,
} from '@utils/widget/g-meter-utils';
import type { EnvelopePoint, TrailPoint } from '@widgets/GMeterWidget/types';
import type { GMeterWidgetSettings } from '@/types/widget-settings';

import styles from './GMeterTrace.module.scss';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface GMeterTraceProps {
  width: number;
  height: number;
}

// Not wrapped in observer() intentionally: autorun() inside useEffect subscribes
// to MobX observables directly, so React re-renders are not needed for data updates.
// observer() would cause 60 Hz React re-renders on every carDynamics change.
export const GMeterTrace = ({ width, height }: GMeterTraceProps) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef(0);

  // Synced each render so autorun always reads fresh props without effect restart.
  const dimsRef = useRef({ width, height });

  dimsRef.current = { width, height };

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
      mode: GMeterWidgetSettings['displayMode'],
      scale: number
    ) => {
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      const { width: currentWidth, height: currentHeight } = dimsRef.current;
      const dpr = window.devicePixelRatio || 1;

      if (
        canvas.width !== Math.round(currentWidth * dpr) ||
        canvas.height !== Math.round(currentHeight * dpr)
      ) {
        canvas.width = Math.round(currentWidth * dpr);
        canvas.height = Math.round(currentHeight * dpr);
        ctx.scale(dpr, dpr);
      }

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
    },
    []
  );

  useEffect(() => {
    const disposer = autorun(() => {
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

      cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        drawTrace(canvas, settings.displayMode, settings.scale);
      });
    });

    return () => {
      disposer();
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [telemetry, widgetSettings, drawTrace]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-label="G-meter trace"
    />
  );
};
