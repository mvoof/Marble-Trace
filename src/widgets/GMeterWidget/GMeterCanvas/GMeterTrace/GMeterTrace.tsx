import { useEffect, useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

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

export const GMeterTrace = observer(({ width, height }: GMeterTraceProps) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { displayMode, scale, colorMode } =
    widgetSettings.getSettings<GMeterWidgetSettings>('g-meter');

  const dynamics = telemetry.carDynamics;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef(0);

  const stateRef = useRef({
    smoothedLatG: 0,
    smoothedLonG: 0,
    gEnvelope: Array.from(
      { length: 360 },
      (): EnvelopePoint => ({ r: 0, color: COLOR_TURN })
    ),
    gHistory: [] as TrailPoint[],
  });

  const widthRef = useRef(width);
  const heightRef = useRef(height);

  const displayModeRef = useRef(displayMode);

  const scaleRef = useRef(scale);

  const colorModeRef = useRef(colorMode);

  const latAccelRef = useRef(dynamics?.lat_accel ?? 0);
  const lonAccelRef = useRef(dynamics?.long_accel ?? 0);

  widthRef.current = width;
  heightRef.current = height;
  displayModeRef.current = displayMode;
  colorModeRef.current = colorMode;
  latAccelRef.current = dynamics?.lat_accel ?? 0;
  lonAccelRef.current = dynamics?.long_accel ?? 0;

  useEffect(() => {
    scaleRef.current = scale;

    const state = stateRef.current;

    state.gEnvelope = Array.from(
      { length: 360 },
      (): EnvelopePoint => ({ r: 0, color: COLOR_TURN })
    );

    state.gHistory = [];
    state.smoothedLatG = 0;
    state.smoothedLonG = 0;
  }, [scale]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const drawTrace = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const currentWidth = widthRef.current;
    const currentHeight = heightRef.current;
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
    const pxPerG = radius / scaleRef.current;
    const state = stateRef.current;

    ctx.clearRect(0, 0, currentWidth, currentHeight);

    const envelope = state.gEnvelope;
    const mode = displayModeRef.current;

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
  };

  useLayoutEffect(() => {
    const rawLat = latAccelRef.current / G_CONSTANT;
    const rawLon = lonAccelRef.current / G_CONSTANT;

    const state = stateRef.current;

    state.smoothedLatG += (rawLat - state.smoothedLatG) * SMOOTHING;
    state.smoothedLonG += (rawLon - state.smoothedLonG) * SMOOTHING;

    let dist = Math.sqrt(state.smoothedLatG ** 2 + state.smoothedLonG ** 2);

    const maxG = scaleRef.current;

    if (dist > maxG) {
      const ratio = maxG / dist;

      state.smoothedLatG *= ratio;
      state.smoothedLonG *= ratio;

      dist = maxG;
    }

    const color = computeColor(
      colorModeRef.current,
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

    if (displayModeRef.current === 'fading') {
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
      if (canvasRef.current) {
        drawTrace(canvasRef.current);
      }
    });
  });

  return <canvas ref={canvasRef} className={styles.canvas} />;
});
