import type { FuelLapRecord } from '@/types/bindings';
import {
  FUEL_COLORS,
  FUEL_CHART_CONFIG,
} from '@utils/constants/fuel-constants';

const barColor = (record: FuelLapRecord, avg: number | null): string => {
  if (record.rejected !== null) return FUEL_COLORS.rejected;

  if (avg === null) return FUEL_COLORS.primary;

  return record.used > avg ? FUEL_COLORS.danger : FUEL_COLORS.safe;
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

const drawXLabels = (
  ctx: CanvasRenderingContext2D,
  data: FuelLapRecord[],
  barWPlusGap: number,
  barW: number,
  plotH: number,
  offsetX: number
) => {
  const n = data.length;

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

  const widestLap = Math.max(...data.map((record) => record.lap));
  const maxLabelW = String(widestLap).length * charW + minGap;

  const step = Math.max(1, Math.ceil(maxLabelW / barWPlusGap));

  let lastDrawnX = -Infinity;

  for (let i = 0; i < n; i++) {
    if (i % step !== 0) continue;

    const cx = offsetX + i * barWPlusGap + barW / 2;

    if (cx - lastDrawnX < maxLabelW) continue;

    // The lap the record carries, not its index: rejected laps stay in the
    // history but a stint that dropped any would otherwise renumber the axis.
    ctx.fillText(String(data[i].lap), cx, plotH + 3);
    lastDrawnX = cx;
  }
};

const prepareChartData = (
  history: FuelLapRecord[],
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

  // The scale follows the laps that count. A caution lap crawling behind the
  // safety car sits far below racing consumption, and letting it set the floor
  // would squash every real lap into the top of the plot; such a bar is clamped
  // to the edge instead, which still reads as "off the scale".
  const scaled = data.filter((record) => record.rejected === null);
  const used = (scaled.length > 0 ? scaled : data).map((record) => record.used);

  const plotH = h - FUEL_CHART_CONFIG.X_LABEL_H;

  return {
    data,
    used,
    stride,
    paddingH,
    plotW,
    plotH,
  };
};

export const drawBarChart = (
  ctx: CanvasRenderingContext2D,
  history: FuelLapRecord[],
  w: number,
  h: number,
  avg: number | null,
  barWidth: number
) => {
  const prepared = prepareChartData(history, w, h, barWidth);

  if (!prepared) {
    return;
  }

  const { data, used, stride, paddingH, plotH } = prepared;

  const min = Math.min(...used) * FUEL_CHART_CONFIG.MIN_SCALE;
  const max = Math.max(...used) * FUEL_CHART_CONFIG.MAX_SCALE;

  const range = max - min || 1;

  const toBarH = (v: number) =>
    Math.max(0, Math.min(plotH, ((v - min) / range) * plotH));

  data.forEach((record, i) => {
    const x = paddingH + i * stride;
    const bh = toBarH(record.used);

    ctx.fillStyle = barColor(record, avg);

    ctx.fillRect(x, plotH - bh, barWidth, bh);
  });

  if (avg !== null) {
    const avgY = plotH - toBarH(avg);

    drawAvgLine(ctx, avgY, w);
  }

  drawXLabels(ctx, data, stride, barWidth, plotH, paddingH);
};

export const drawLineChart = (
  ctx: CanvasRenderingContext2D,
  history: FuelLapRecord[],
  w: number,
  h: number,
  avg: number | null,
  barWidth: number
) => {
  const prepared = prepareChartData(history, w, h, barWidth);

  if (!prepared) {
    return;
  }

  const { data, used, stride, paddingH, plotH } = prepared;

  const min = Math.min(...used) * FUEL_CHART_CONFIG.MIN_SCALE_LINE;
  const max = Math.max(...used) * FUEL_CHART_CONFIG.MAX_SCALE;

  const range = max - min || 1;

  const toY = (v: number) =>
    Math.max(0, Math.min(plotH, plotH - ((v - min) / range) * plotH));
  const toX = (i: number) => paddingH + i * stride + barWidth / 2;

  ctx.beginPath();
  ctx.strokeStyle = FUEL_COLORS.primary;
  ctx.lineWidth = 1.5;

  // The trend line steps over rejected laps rather than through them: it tracks
  // racing consumption, and a caution lap is not a dip in that.
  let started = false;

  data.forEach((record, i) => {
    if (record.rejected !== null) {
      return;
    }

    const x = toX(i);
    const y = toY(record.used);

    if (started) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      started = true;
    }
  });

  ctx.stroke();

  data.forEach((record, i) => {
    const x = toX(i);
    const y = toY(record.used);

    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = barColor(record, avg);

    ctx.fill();
  });

  if (avg !== null) {
    drawAvgLine(ctx, toY(avg), w);
  }

  drawXLabels(ctx, data, stride, barWidth, plotH, paddingH);
};
