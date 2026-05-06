import { FUEL_COLORS, FUEL_CHART_CONFIG } from '../fuel-constants';

export const barColor = (v: number, avg: number | null): string => {
  if (avg === null) return FUEL_COLORS.primary;
  return v > avg ? FUEL_COLORS.danger : FUEL_COLORS.safe;
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

export const drawTopLine = (ctx: CanvasRenderingContext2D, plotW: number) => {
  ctx.strokeStyle = FUEL_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(plotW, 0);
  ctx.stroke();
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
  const plotW = w;
  const plotH = h - FUEL_CHART_CONFIG.X_LABEL_H;

  const min = Math.min(...data) * FUEL_CHART_CONFIG.MIN_SCALE;
  const max = Math.max(...data) * FUEL_CHART_CONFIG.MAX_SCALE;
  const range = max - min || 1;

  const barW = FUEL_CHART_CONFIG.BAR_WIDTH;
  const stride = barW + FUEL_CHART_CONFIG.BAR_GAP;

  const toBarH = (v: number) => ((v - min) / range) * plotH;

  data.forEach((v, i) => {
    const x = i * stride;
    const bh = toBarH(v);
    ctx.fillStyle = barColor(v, avg);
    ctx.fillRect(x, plotH - bh, barW, bh);
  });

  drawTopLine(ctx, plotW);

  if (avg !== null) {
    const avgY = plotH - toBarH(avg);
    drawAvgLine(ctx, avgY, plotW);
  }

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
  const plotW = w;
  const plotH = h - FUEL_CHART_CONFIG.X_LABEL_H;

  const min = Math.min(...data) * FUEL_CHART_CONFIG.MIN_SCALE_LINE;
  const max = Math.max(...data) * FUEL_CHART_CONFIG.MAX_SCALE;
  const range = max - min || 1;

  const toY = (v: number) => plotH - ((v - min) / range) * plotH;
  const toX = (i: number) =>
    data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2;

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

  drawTopLine(ctx, plotW);

  if (avg !== null) {
    drawAvgLine(ctx, toY(avg), plotW);
  }

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
