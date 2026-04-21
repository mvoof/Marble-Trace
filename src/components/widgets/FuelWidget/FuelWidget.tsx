import { useEffect, useRef } from 'react';

import { WidgetPanel } from '../primitives/WidgetPanel';
import {
  formatFuelLiters,
  formatLaps,
  type FuelCalculations,
} from './fuel-utils';

import styles from './FuelWidget.module.scss';

interface FuelWidgetProps {
  fuelLevel: number | null;
  fuelMax: number | null;
  avgPerLap: FuelCalculations['avgPerLap'];
  lapsRemaining: FuelCalculations['lapsRemaining'];
  lapsToFinish: FuelCalculations['lapsToFinish'];
  shortage: FuelCalculations['shortage'];
  fuelToAddWithBuffer: FuelCalculations['fuelToAddWithBuffer'];
  fuelSavePerLap: FuelCalculations['fuelSavePerLap'];
  pitWarning: FuelCalculations['pitWarning'];
  pitWindowStart: FuelCalculations['pitWindowStart'];
  pitWindowEnd: FuelCalculations['pitWindowEnd'];
  showChart: boolean;
  chartType: 'line' | 'bar';
  lapFuelHistory: number[];
}

const statusClass = (shortage: number | null): string => {
  if (shortage === null || shortage >= 0) return styles.statusSafe;
  return styles.statusShort;
};

const statusText = (shortage: number | null): string => {
  if (shortage === null) return 'SAFE';
  if (shortage < 0) return 'SHORT';
  return `SAFE +${shortage.toFixed(1)}L`;
};

const valueClass = (shortage: number | null): string => {
  if (shortage === null) return '';
  return shortage >= 0 ? styles.rowValueSafe : styles.rowValueShort;
};

interface FuelChartProps {
  history: number[];
  chartType: 'line' | 'bar';
  avgPerLap: number | null;
}

const MAX_VISIBLE = 30;
const Y_LABEL_W = 32;
const X_LABEL_H = 14;
const GRID_COUNT = 4;

const barColor = (v: number, avg: number | null): string => {
  if (avg === null) return '#3399ff';
  return v > avg ? '#ef4444' : '#22c55e';
};

const drawYLabels = (
  ctx: CanvasRenderingContext2D,
  min: number,
  max: number,
  plotH: number,
  totalW: number
) => {
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';

  for (let g = 1; g < GRID_COUNT; g++) {
    const ratio = g / GRID_COUNT;
    const gy = plotH * (1 - ratio);
    const val = min + (max - min) * ratio;
    ctx.fillText(val.toFixed(1), totalW - 1, gy);
  }
};

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  plotH: number,
  left: number,
  right: number
) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  for (let g = 1; g < GRID_COUNT; g++) {
    const gy = plotH * (1 - g / GRID_COUNT);
    ctx.beginPath();
    ctx.moveTo(left, gy);
    ctx.lineTo(right, gy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
};

const drawAvgLine = (
  ctx: CanvasRenderingContext2D,
  avgY: number,
  plotW: number
) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(0, avgY);
  ctx.lineTo(plotW, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('AVG', 1, avgY - 1);
};

const drawXLabels = (
  ctx: CanvasRenderingContext2D,
  n: number,
  barWPlusGap: number,
  barW: number,
  plotH: number
) => {
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';

  const step = n <= 10 ? 1 : n <= 20 ? 2 : 5;
  for (let i = 0; i < n; i++) {
    if (i % step !== 0 && i !== n - 1) continue;
    const cx = i * barWPlusGap + barW / 2;
    ctx.fillText(String(i + 1), cx, plotH + 3);
  }
};

const drawBarChart = (
  ctx: CanvasRenderingContext2D,
  history: number[],
  w: number,
  h: number,
  avg: number | null
) => {
  const data = history.slice(-MAX_VISIBLE);
  const n = data.length;
  const plotW = w - Y_LABEL_W;
  const plotH = h - X_LABEL_H;

  const min = Math.min(...data) * 0.88;
  const max = Math.max(...data) * 1.08;
  const range = max - min || 1;

  const gap = n > 1 ? Math.max(1, Math.floor(plotW / n / 8)) : 0;
  const barW = Math.max(2, (plotW - gap * (n - 1)) / n);
  const stride = barW + gap;

  const toBarH = (v: number) => ((v - min) / range) * plotH;

  drawGridLines(ctx, plotH, 0, plotW);

  if (avg !== null) {
    const avgY = plotH - toBarH(avg);
    drawAvgLine(ctx, avgY, plotW);
  }

  drawYLabels(ctx, min, max, plotH, w);

  data.forEach((v, i) => {
    const x = i * stride;
    const bh = toBarH(v);
    ctx.fillStyle = barColor(v, avg);
    ctx.fillRect(x, plotH - bh, barW, bh);
  });

  drawXLabels(ctx, n, stride, barW, plotH);
};

const drawLineChart = (
  ctx: CanvasRenderingContext2D,
  history: number[],
  w: number,
  h: number,
  avg: number | null
) => {
  const data = history.slice(-MAX_VISIBLE);
  const plotW = w - Y_LABEL_W;
  const plotH = h - X_LABEL_H;

  const min = Math.min(...data) * 0.92;
  const max = Math.max(...data) * 1.08;
  const range = max - min || 1;

  const toY = (v: number) => plotH - ((v - min) / range) * plotH;
  const toX = (i: number) =>
    data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2;

  drawGridLines(ctx, plotH, 0, plotW);

  if (avg !== null) {
    drawAvgLine(ctx, toY(avg), plotW);
  }

  drawYLabels(ctx, min, max, plotH, w);

  ctx.beginPath();
  ctx.strokeStyle = '#3399ff';
  ctx.lineWidth = 1.5;
  data.forEach((v, i) => {
    const x = toX(i);
    const y = toY(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  data.forEach((v, i) => {
    const x = toX(i);
    const y = toY(v);
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = barColor(v, avg);
    ctx.fill();
  });

  // X labels for line chart
  const n = data.length;
  const step = n <= 10 ? 1 : n <= 20 ? 2 : 5;
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < n; i++) {
    if (i % step !== 0 && i !== n - 1) continue;
    ctx.fillText(String(i + 1), toX(i), plotH + 3);
  }
};

const FuelChart = ({ history, chartType, avgPerLap }: FuelChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (chartType === 'bar') {
      drawBarChart(ctx, history, w, h, avgPerLap);
    } else {
      drawLineChart(ctx, history, w, h, avgPerLap);
    }
  }, [history, chartType, avgPerLap]);

  return <canvas ref={canvasRef} className={styles.chartCanvas} />;
};

export const FuelWidget = ({
  fuelLevel,
  fuelMax,
  avgPerLap,
  lapsRemaining,
  lapsToFinish,
  shortage,
  fuelToAddWithBuffer,
  fuelSavePerLap,
  pitWarning,
  pitWindowStart,
  pitWindowEnd,
  showChart,
  chartType,
  lapFuelHistory,
}: FuelWidgetProps) => {
  const pct =
    fuelLevel !== null && fuelMax !== null && fuelMax > 0
      ? Math.min(fuelLevel / fuelMax, 1)
      : null;

  const isShort = shortage !== null && shortage < 0;
  const windowText =
    pitWindowStart !== null && pitWindowEnd !== null
      ? `LAP ${pitWindowStart}–${pitWindowEnd}`
      : '—';

  const lapsDisplay =
    lapsRemaining !== null && lapsToFinish !== null
      ? `${formatLaps(lapsRemaining)} / ${formatLaps(lapsToFinish)}`
      : formatLaps(lapsRemaining);

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>FUEL</span>
        <span className={`${styles.statusBadge} ${statusClass(shortage)}`}>
          {statusText(shortage)}
        </span>
      </div>

      <div className={styles.progressWrap}>
        {pct !== null && (
          <div
            className={styles.progressBar}
            style={{ width: `${pct * 100}%` }}
          />
        )}
        <div className={styles.progressLabels}>
          <span>
            {fuelLevel !== null ? `${fuelLevel.toFixed(1)} L` : '— L'}
          </span>
          <span className={styles.progressLabelMuted}>
            {fuelMax !== null ? `${fuelMax.toFixed(0)} L` : ''}
          </span>
        </div>
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>PER LAP</span>
          <span className={styles.rowValue}>{formatFuelLiters(avgPerLap)}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>LEFT / FINISH</span>
          <span className={`${styles.rowValue} ${valueClass(shortage)}`}>
            {lapsDisplay}
          </span>
        </div>

        {fuelSavePerLap !== null ? (
          <div className={styles.row}>
            <span className={styles.rowLabel}>SAVE/LAP</span>
            <span className={`${styles.rowValue} ${styles.rowValueWarn}`}>
              {fuelSavePerLap.toFixed(2)} L
            </span>
          </div>
        ) : (
          !isShort &&
          fuelToAddWithBuffer !== null &&
          fuelToAddWithBuffer > 0 && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>FILL +1 LAP</span>
              <span className={`${styles.rowValue} ${styles.rowValueMuted}`}>
                {formatFuelLiters(fuelToAddWithBuffer)}
              </span>
            </div>
          )
        )}
      </div>

      {showChart && lapFuelHistory.length >= 2 && (
        <div className={styles.chart}>
          <span className={styles.chartLabel}>USE/LAP HISTORY</span>
          <FuelChart
            history={lapFuelHistory}
            chartType={chartType}
            avgPerLap={avgPerLap}
          />
        </div>
      )}

      {pitWarning && (
        <div
          className={`${styles.pitWarning} ${isShort ? styles.pitWarningUrgent : ''}`}
        >
          <div className={styles.pitWarningHeader}>
            <span className={styles.pitWarningHeaderLabel}>PIT WINDOW</span>
            <span className={styles.pitWarningWindow}>{windowText}</span>
          </div>

          <div className={styles.pitWarningSeparator} />

          <div className={styles.pitWarningBody}>
            <div className={styles.pitWarningBodyLeft}>
              <span className={styles.pitWarningBodyLabel}>TO REFUEL</span>
              <span className={styles.pitWarningBodySub}>
                incl. +1 lap buffer
              </span>
            </div>
            <span
              className={`${styles.pitWarningAmount} ${isShort ? styles.pitWarningAmountDanger : ''}`}
            >
              {fuelToAddWithBuffer !== null
                ? fuelToAddWithBuffer.toFixed(1)
                : '—'}
              <span className={styles.pitWarningAmountUnit}> L</span>
            </span>
          </div>
        </div>
      )}
    </WidgetPanel>
  );
};
