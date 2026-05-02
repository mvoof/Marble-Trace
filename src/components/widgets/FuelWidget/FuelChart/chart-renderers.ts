import { FUEL_COLORS, FUEL_CHART_CONFIG } from '../fuel-constants';

export const barColor = (v: number, avg: number | null): string => {
  if (avg === null) return FUEL_COLORS.primary;
  return v > avg ? FUEL_COLORS.danger : FUEL_COLORS.safe;
};

export const drawYLabels = (
  ctx: CanvasRenderingContext2D,
  min: number,
  max: number,
  plotH: number,
  totalW: number
) => {
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = FUEL_COLORS.textMuted;

  for (let g = 1; g < FUEL_CHART_CONFIG.GRID_COUNT; g++) {
    const ratio = g / FUEL_CHART_CONFIG.GRID_COUNT;
    const gy = plotH * (1 - ratio);
    const val = min + (max - min) * ratio;
    ctx.fillText(val.toFixed(1), totalW - 1, gy);
  }
};

export const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  plotH: number,
  left: number,
  right: number
) => {
  ctx.strokeStyle = FUEL_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  for (let g = 1; g < FUEL_CHART_CONFIG.GRID_COUNT; g++) {
    const gy = plotH * (1 - g / FUEL_CHART_CONFIG.GRID_COUNT);
    ctx.beginPath();
    ctx.moveTo(left, gy);
    ctx.lineTo(right, gy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
};

export const drawAvgLine = (
  ctx: CanvasRenderingContext2D,
  avgY: number,
  plotW: number
) => {
  ctx.strokeStyle = FUEL_COLORS.average;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(0, avgY);
  ctx.lineTo(plotW, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = FUEL_COLORS.averageLabel;
  ctx.fillText('AVG', 1, avgY - 1);
};

export const drawXLabels = (
  ctx: CanvasRenderingContext2D,
  n: number,
  barWPlusGap: number,
  barW: number,
  plotH: number
) => {
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = FUEL_COLORS.textMuted;

  const maxLabelW =
    String(n).length * FUEL_CHART_CONFIG.LABEL_CHAR_W +
    FUEL_CHART_CONFIG.LABEL_MIN_GAP;
  const step = Math.max(1, Math.ceil(maxLabelW / barWPlusGap));

  let lastDrawnX = -Infinity;
  for (let i = 0; i < n; i++) {
    if (i % step !== 0) continue;
    const cx = i * barWPlusGap + barW / 2;
    if (cx - lastDrawnX < maxLabelW) continue;
    ctx.fillText(String(i + 1), cx, plotH + 3);
    lastDrawnX = cx;
  }
};

export const drawBarChart = (
  ctx: CanvasRenderingContext2D,
  history: number[],
  w: number,
  h: number,
  avg: number | null
) => {
  const data = history.slice(-FUEL_CHART_CONFIG.MAX_VISIBLE);
  const n = data.length;
  const plotW = w - FUEL_CHART_CONFIG.Y_LABEL_W;
  const plotH = h - FUEL_CHART_CONFIG.X_LABEL_H;

  const min = Math.min(...data) * 0.88;
  const max = Math.max(...data) * 1.08;
  const range = max - min || 1;

  const barW = FUEL_CHART_CONFIG.BAR_WIDTH;
  const stride = barW + FUEL_CHART_CONFIG.BAR_GAP;

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

export const drawLineChart = (
  ctx: CanvasRenderingContext2D,
  history: number[],
  w: number,
  h: number,
  avg: number | null
) => {
  const data = history.slice(-FUEL_CHART_CONFIG.MAX_VISIBLE);
  const n = data.length;
  const plotW = w - FUEL_CHART_CONFIG.Y_LABEL_W;
  const plotH = h - FUEL_CHART_CONFIG.X_LABEL_H;

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
  ctx.strokeStyle = FUEL_COLORS.primary;
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

  const lineStride = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const maxLabelW =
    String(n).length * FUEL_CHART_CONFIG.LABEL_CHAR_W +
    FUEL_CHART_CONFIG.LABEL_MIN_GAP;
  const step = Math.max(1, Math.ceil(maxLabelW / lineStride));

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = FUEL_COLORS.textMuted;
  let lastDrawnX = -Infinity;
  for (let i = 0; i < n; i++) {
    if (i % step !== 0) continue;
    const cx = toX(i);
    if (cx - lastDrawnX < maxLabelW) continue;
    ctx.fillText(String(i + 1), cx, plotH + 3);
    lastDrawnX = cx;
  }
};
