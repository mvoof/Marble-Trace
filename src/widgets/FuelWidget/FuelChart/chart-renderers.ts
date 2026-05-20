import {
  FUEL_COLORS,
  FUEL_CHART_CONFIG,
} from '@utils/constants/fuel-constants';

const barColor = (v: number, avg: number | null): string => {
  if (avg === null) return FUEL_COLORS.primary;

  return v > avg ? FUEL_COLORS.danger : FUEL_COLORS.safe;
};

const drawAvgLine = (
  ctx: CanvasRenderingContext2D,
  avgY: number,
  plotW: number
) => {
  ctx.strokeStyle = FUEL_COLORS.average;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(0, avgY);
  ctx.lineTo(plotW, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = FUEL_COLORS.averageLabel;
  ctx.fillText('AVG', plotW, avgY - 1);
};

const drawTopLine = (ctx: CanvasRenderingContext2D, plotW: number) => {
  ctx.strokeStyle = FUEL_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(plotW, 0);
  ctx.stroke();
};

const drawXLabels = (
  ctx: CanvasRenderingContext2D,
  n: number,
  barWPlusGap: number,
  barW: number,
  plotH: number,
  startLap: number,
  offsetX: number
) => {
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = FUEL_COLORS.textMuted;

  // Dynamic label width estimation:
  // On wide bars we can be tighter (charW 6, gap 1)
  // On narrow bars we need more breathing room (charW 8, gap 4)
  const isWide = barW > 12;
  const charW = isWide ? 6 : 8;
  const minGap = isWide ? 1 : 4;

  const maxLabelW = String(startLap + n).length * charW + minGap;

  const step = Math.max(1, Math.ceil(maxLabelW / barWPlusGap));

  let lastDrawnX = -Infinity;

  for (let i = 0; i < n; i++) {
    if (i % step !== 0) continue;

    const cx = offsetX + i * barWPlusGap + barW / 2;

    if (cx - lastDrawnX < maxLabelW) continue;

    ctx.fillText(String(startLap + i), cx, plotH + 3);
    lastDrawnX = cx;
  }
};

const prepareChartData = (
  history: number[],
  w: number,
  h: number,
  barWidth: number
) => {
  const stride = barWidth + FUEL_CHART_CONFIG.BAR_GAP;
  const paddingH = FUEL_CHART_CONFIG.PADDING_H;
  const plotW = w - paddingH * 2;
  const maxVisible = stride > 0 ? Math.floor(plotW / stride) : 0;

  const data = maxVisible > 0 ? history.slice(-maxVisible) : [];

  if (data.length === 0) {
    return null;
  }

  const startLap = Math.max(1, history.length - data.length + 1);
  const plotH = h - FUEL_CHART_CONFIG.X_LABEL_H;

  return {
    data,
    stride,
    paddingH,
    plotW,
    plotH,
    startLap,
    n: data.length,
  };
};

export const drawBarChart = (
  ctx: CanvasRenderingContext2D,
  history: number[],
  w: number,
  h: number,
  avg: number | null,
  barWidth: number
) => {
  const prepared = prepareChartData(history, w, h, barWidth);

  if (!prepared) {
    return;
  }

  const { data, stride, paddingH, plotH, startLap, n } = prepared;

  const min = Math.min(...data) * FUEL_CHART_CONFIG.MIN_SCALE;
  const max = Math.max(...data) * FUEL_CHART_CONFIG.MAX_SCALE;
  const range = max - min || 1;

  const toBarH = (v: number) => ((v - min) / range) * plotH;

  data.forEach((v, i) => {
    const x = paddingH + i * stride;
    const bh = toBarH(v);

    ctx.fillStyle = barColor(v, avg);
    ctx.fillRect(x, plotH - bh, barWidth, bh);
  });

  drawTopLine(ctx, w);

  if (avg !== null) {
    const avgY = plotH - toBarH(avg);

    drawAvgLine(ctx, avgY, w);
  }

  drawXLabels(ctx, n, stride, barWidth, plotH, startLap, paddingH);
};

export const drawLineChart = (
  ctx: CanvasRenderingContext2D,
  history: number[],
  w: number,
  h: number,
  avg: number | null,
  barWidth: number
) => {
  const prepared = prepareChartData(history, w, h, barWidth);

  if (!prepared) {
    return;
  }

  const { data, stride, paddingH, plotH, startLap, n } = prepared;

  const min = Math.min(...data) * FUEL_CHART_CONFIG.MIN_SCALE_LINE;
  const max = Math.max(...data) * FUEL_CHART_CONFIG.MAX_SCALE;
  const range = max - min || 1;

  const toY = (v: number) => plotH - ((v - min) / range) * plotH;
  const toX = (i: number) => paddingH + i * stride + barWidth / 2;

  ctx.beginPath();
  ctx.strokeStyle = FUEL_COLORS.primary;
  ctx.lineWidth = 1.5;
  data.forEach((v, i) => {
    const x = toX(i);
    const y = toY(v);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
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

  drawTopLine(ctx, w);

  if (avg !== null) {
    drawAvgLine(ctx, toY(avg), w);
  }

  drawXLabels(ctx, n, stride, barWidth, plotH, startLap, paddingH);
};
