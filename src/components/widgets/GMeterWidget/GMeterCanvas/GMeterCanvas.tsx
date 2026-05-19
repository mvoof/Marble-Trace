import { useEffect, useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import {
  COLOR_TURN,
  ENVELOPE_SPREAD,
  FADING_DECAY,
  G_CONSTANT,
  RADIUS_RATIO,
  SMOOTHING,
  TRACE_LENGTH,
  computeColor,
} from '../g-meter-utils';
import type { EnvelopePoint, TrailPoint } from '../types';

import styles from './GMeterCanvas.module.scss';

export const GMeterCanvas = observer(() => {
  const { displayMode, scale, colorMode } =
    widgetSettingsStore.getGMeterSettings();

  const dynamics = telemetryStore.carDynamics;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef(0);

  const stateRef = useRef({
    smoothedLatG: 0,
    smoothedLonG: 0,
    peakLatG: 0,
    peakLonG: 0,
    gEnvelope: Array.from(
      { length: 360 },
      (): EnvelopePoint => ({ r: 0, color: COLOR_TURN })
    ),
    gHistory: [] as TrailPoint[],
  });

  const displayModeRef = useRef(displayMode);
  const scaleRef = useRef(scale);
  const colorModeRef = useRef(colorMode);

  const latAccelRef = useRef(dynamics?.lat_accel ?? 0);
  const lonAccelRef = useRef(dynamics?.long_accel ?? 0);

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
    state.peakLatG = 0;
    state.peakLonG = 0;
  }, [scale]);

  const drawFrame = (
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ) => {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.scale(dpr, dpr);
    }

    const cx = width / 2;
    const cy = height / 2;

    const radius = Math.min(width, height) * RADIUS_RATIO * 0.5;

    const maxG = scaleRef.current;
    const pxPerG = radius / maxG;
    const state = stateRef.current;

    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 1;

    for (let gValue = 1; gValue <= maxG; gValue++) {
      ctx.beginPath();

      ctx.arc(cx, cy, gValue * pxPerG, 0, Math.PI * 2);
      ctx.strokeStyle =
        gValue === maxG ? 'rgba(58,59,64,1)' : 'rgba(42,43,48,0.8)';

      ctx.stroke();
    }

    const labelSize = Math.round(14 * (width / 240));

    ctx.font = `600 ${labelSize}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = 'rgba(120,120,130,0.7)';

    const pad = 3;

    for (let gValue = 1; gValue <= maxG; gValue++) {
      const ringRadius = gValue * pxPerG;
      const label = String(gValue);

      const textWidth = ctx.measureText(label).width;

      ctx.textBaseline = 'bottom';

      ctx.fillText(label, cx - textWidth / 2, cy - ringRadius - pad);

      ctx.textBaseline = 'top';

      ctx.fillText(label, cx - textWidth / 2, cy + ringRadius + pad);

      ctx.textBaseline = 'middle';

      ctx.fillText(label, cx - ringRadius - textWidth - pad, cy);
      ctx.fillText(label, cx + ringRadius + pad, cy);
    }

    ctx.beginPath();

    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);

    ctx.strokeStyle = 'rgba(58,59,64,0.8)';
    ctx.lineWidth = 1;

    ctx.stroke();

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    if (!canvas || !wrap) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;

      drawFrame(canvas, width, height);
    });

    resizeObserver.observe(wrap);

    const initialRect = wrap.getBoundingClientRect();

    drawFrame(canvas, initialRect.width, initialRect.height);

    return () => {
      resizeObserver.disconnect();

      cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

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

    if (Math.abs(state.smoothedLatG) > state.peakLatG) {
      state.peakLatG = Math.abs(state.smoothedLatG);
    }

    if (Math.abs(state.smoothedLonG) > state.peakLonG) {
      state.peakLonG = Math.abs(state.smoothedLonG);
    }

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
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;

      if (canvas && wrap) {
        const rect = wrap.getBoundingClientRect();

        drawFrame(canvas, rect.width, rect.height);
      }
    });
  });

  return (
    <div ref={wrapRef} className={styles.canvasWrap}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
});
