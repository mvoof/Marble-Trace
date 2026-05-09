import { useEffect, useRef } from 'react';
import { autorun } from 'mobx';
import type {
  GMeterColorMode,
  GMeterDisplayMode,
} from '../../../types/widget-settings';
import { telemetryStore } from '../../../store/iracing';
import { WidgetPanel } from '../primitives';
import styles from './GMeterWidget.module.scss';

const G_CONSTANT = 9.81;
const SMOOTHING = 0.12;
const TRACE_LENGTH = 100;
const FADING_DECAY = 0.9992;
const ENVELOPE_SPREAD = 10;
const RADIUS_RATIO = 0.86;

const COLOR_TURN = '#3399ff';
const COLOR_BRAKE = '#ef4444';
const COLOR_ACCEL = '#22c55e';
const COLOR_IDLE = '#adadad';

interface EnvelopePoint {
  r: number;
  color: string;
}

interface TrailPoint {
  lat: number;
  lon: number;
  color: string;
}

interface GMeterWidgetProps {
  displayMode: GMeterDisplayMode;
  scale: 2 | 3 | 4 | 5;
  colorMode: GMeterColorMode;
}

const computeColor = (
  colorMode: GMeterColorMode,
  latG: number,
  lonG: number,
  dist: number
): string => {
  if (colorMode === 'mono') return COLOR_TURN;

  if (colorMode === 'simple') {
    if (lonG < -0.15) return COLOR_BRAKE;
    if (lonG > 0.15) return COLOR_ACCEL;
    return COLOR_TURN;
  }

  if (dist < 0.1) return COLOR_IDLE;

  const angle = Math.atan2(Math.abs(lonG), Math.abs(latG));
  let wLon = angle / (Math.PI / 2);
  wLon = Math.pow(wLon, 0.5);
  const wTurn = 1.0 - wLon;

  if (lonG < 0) {
    // brake (#ef4444 = 239,68,68) → turn (#3399ff = 51,153,255)
    const r = Math.round(239 * wLon + 51 * wTurn);
    const g = Math.round(68 * wLon + 153 * wTurn);
    const b = Math.round(68 * wLon + 255 * wTurn);
    return `rgb(${r},${g},${b})`;
  } else {
    // accel (#22c55e = 34,197,94) → turn (#3399ff = 51,153,255)
    const r = Math.round(34 * wLon + 51 * wTurn);
    const g = Math.round(197 * wLon + 153 * wTurn);
    const b = Math.round(94 * wLon + 255 * wTurn);
    return `rgb(${r},${g},${b})`;
  }
};

export const GMeterWidget = ({
  displayMode,
  scale,
  colorMode,
}: GMeterWidgetProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const latRef = useRef<HTMLSpanElement>(null);
  const lonRef = useRef<HTMLSpanElement>(null);
  const peakLatRef = useRef<HTMLSpanElement>(null);
  const peakLonRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    displayModeRef.current = displayMode;
  }, [displayMode]);

  useEffect(() => {
    colorModeRef.current = colorMode;
  }, [colorMode]);

  useEffect(() => {
    scaleRef.current = scale;
    const s = stateRef.current;
    s.gEnvelope = Array.from(
      { length: 360 },
      (): EnvelopePoint => ({ r: 0, color: COLOR_TURN })
    );
    s.gHistory = [];
    s.peakLatG = 0;
    s.peakLonG = 0;
    if (peakLatRef.current) peakLatRef.current.textContent = '0.0';
    if (peakLonRef.current) peakLonRef.current.textContent = '0.0';
  }, [scale]);

  const drawFrame = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * RADIUS_RATIO * 0.5;
    const maxG = scaleRef.current;
    const pxPerG = radius / maxG;
    const s = stateRef.current;

    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (let g = 1; g <= maxG; g++) {
      ctx.beginPath();
      ctx.arc(cx, cy, g * pxPerG, 0, Math.PI * 2);
      ctx.strokeStyle = g === maxG ? 'rgba(58,59,64,1)' : 'rgba(42,43,48,0.8)';
      ctx.stroke();
    }

    const labelSize = Math.max(9, Math.min(14, radius * 0.08));
    ctx.font = `600 ${labelSize}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = 'rgba(120,120,130,0.7)';
    const pad = 3;
    for (let g = 1; g <= maxG; g++) {
      const r = g * pxPerG;
      const label = String(g);
      const tw = ctx.measureText(label).width;
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx - tw / 2, cy - r + labelSize - pad);
      ctx.textBaseline = 'top';
      ctx.fillText(label, cx - tw / 2, cy + r + pad);
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx - r - tw - pad, cy);
      ctx.fillText(label, cx + r + pad, cy);
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.strokeStyle = 'rgba(58,59,64,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const envelope = s.gEnvelope;
    const mode = displayModeRef.current;

    if (mode === 'trail') {
      if (s.gHistory.length >= 2) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        for (let i = 1; i < s.gHistory.length; i++) {
          const p1 = s.gHistory[i - 1];
          const p2 = s.gHistory[i];
          ctx.beginPath();
          ctx.moveTo(cx + p1.lat * pxPerG, cy + p1.lon * pxPerG);
          ctx.lineTo(cx + p2.lat * pxPerG, cy + p2.lon * pxPerG);
          ctx.globalAlpha = i / s.gHistory.length;
          ctx.strokeStyle = p2.color;
          ctx.shadowColor = p2.color;
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }
    } else {
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 360; i++) {
        const ni = (i + 1) % 360;
        const r1 = envelope[i].r * pxPerG;
        const r2 = envelope[ni].r * pxPerG;
        if (r1 > 0 || r2 > 0) {
          const rad1 = i * (Math.PI / 180);
          const rad2 = ni * (Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + r1 * Math.cos(rad1), cy + r1 * Math.sin(rad1));
          ctx.lineTo(cx + r2 * Math.cos(rad2), cy + r2 * Math.sin(rad2));
          ctx.closePath();
          ctx.fillStyle = envelope[i].color;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 360; i++) {
        const ni = (i + 1) % 360;
        const r1 = envelope[i].r * pxPerG;
        const r2 = envelope[ni].r * pxPerG;
        if (r1 > 0 || r2 > 0) {
          const rad1 = i * (Math.PI / 180);
          const rad2 = ni * (Math.PI / 180);
          ctx.beginPath();
          ctx.moveTo(cx + r1 * Math.cos(rad1), cy + r1 * Math.sin(rad1));
          ctx.lineTo(cx + r2 * Math.cos(rad2), cy + r2 * Math.sin(rad2));
          ctx.strokeStyle = envelope[i].color;
          ctx.stroke();
        }
      }
    }

    const dotX = cx + s.smoothedLatG * pxPerG;
    const dotY = cy + s.smoothedLonG * pxPerG;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle =
      s.gHistory.length > 0
        ? (s.gHistory[s.gHistory.length - 1]?.color ?? COLOR_TURN)
        : COLOR_TURN;
    ctx.fill();
  };

  useEffect(() => {
    return autorun(() => {
      const dynamics = telemetryStore.carDynamics;
      const latAccel = dynamics?.lat_accel ?? null;
      const lonAccel = dynamics?.long_accel ?? null;

      const rawLat = latAccel != null ? latAccel / G_CONSTANT : 0;
      const rawLon = lonAccel != null ? lonAccel / G_CONSTANT : 0;

      const s = stateRef.current;
      s.smoothedLatG += (rawLat - s.smoothedLatG) * SMOOTHING;
      s.smoothedLonG += (rawLon - s.smoothedLonG) * SMOOTHING;

      let dist = Math.sqrt(s.smoothedLatG ** 2 + s.smoothedLonG ** 2);
      const maxG = scaleRef.current;
      if (dist > maxG) {
        const ratio = maxG / dist;
        s.smoothedLatG *= ratio;
        s.smoothedLonG *= ratio;
        dist = maxG;
      }

      const color = computeColor(
        colorModeRef.current,
        s.smoothedLatG,
        s.smoothedLonG,
        dist
      );

      if (Math.abs(s.smoothedLatG) > s.peakLatG)
        s.peakLatG = Math.abs(s.smoothedLatG);
      if (Math.abs(s.smoothedLonG) > s.peakLonG)
        s.peakLonG = Math.abs(s.smoothedLonG);

      const angle = Math.atan2(s.smoothedLonG, s.smoothedLatG);
      let degree = Math.round(angle * (180 / Math.PI));
      if (degree < 0) degree += 360;

      for (let d = -ENVELOPE_SPREAD; d <= ENVELOPE_SPREAD; d++) {
        const idx = (degree + d + 360) % 360;
        const smoothedR = dist * Math.cos((d * Math.PI) / 180);
        if (smoothedR > s.gEnvelope[idx].r) {
          s.gEnvelope[idx].r = smoothedR;
          s.gEnvelope[idx].color = color;
        }
      }

      if (displayModeRef.current === 'fading') {
        for (let i = 0; i < 360; i++) {
          s.gEnvelope[i].r *= FADING_DECAY;
        }
      }

      s.gHistory.push({ lat: s.smoothedLatG, lon: s.smoothedLonG, color });
      if (s.gHistory.length > TRACE_LENGTH) s.gHistory.shift();

      if (latRef.current) {
        latRef.current.textContent = Math.abs(s.smoothedLatG).toFixed(2);
        latRef.current.style.color = color;
      }
      if (lonRef.current) {
        lonRef.current.textContent = Math.abs(s.smoothedLonG).toFixed(2);
        lonRef.current.style.color = color;
      }
      if (peakLatRef.current)
        peakLatRef.current.textContent = s.peakLatG.toFixed(2);
      if (peakLonRef.current)
        peakLonRef.current.textContent = s.peakLonG.toFixed(2);

      if (canvasRef.current) drawFrame(canvasRef.current);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => drawFrame(canvas));
    observer.observe(canvas);
    drawFrame(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <WidgetPanel minWidth={200} gap={0}>
      <div className={styles.root}>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.dashboard}>
          <div className={styles.currentValues}>
            <div className={styles.valueGroup}>
              <span className={styles.axisLabel}>LAT</span>
              <span ref={latRef} className={styles.val}>
                0.00
              </span>
            </div>
            <span className={styles.divider}>|</span>
            <div className={styles.valueGroup}>
              <span className={styles.axisLabel}>LON</span>
              <span ref={lonRef} className={styles.val}>
                0.00
              </span>
            </div>
          </div>
          <div className={styles.peakValues}>
            <span className={styles.peakLabel}>PEAK</span>
            <span ref={peakLatRef} className={styles.peakVal}>
              0.00
            </span>
            <span className={styles.divider}>•</span>
            <span ref={peakLonRef} className={styles.peakVal}>
              0.00
            </span>
          </div>
        </div>
      </div>
    </WidgetPanel>
  );
};
