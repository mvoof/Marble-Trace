import type uPlot from 'uplot';

const BOUNDARY_COLOR = 'rgba(255, 255, 255, 0.14)';
const SHADE_COLOR = 'rgba(255, 255, 255, 0.025)';
const LABEL_COLOR = '#5e626d';
const LABEL_FONT_PX = 10;
/** From the plot's bottom edge down to the labels' baseline, CSS pixels. */
const LABEL_DROP_PX = 34;
const SECTOR_PREFIX = 'S';

/**
 * Sector marks on a chart: a thin line at each boundary, every other sector
 * faintly shaded, and with `labels` S1…Sn under the distance axis, each
 * centred on the part of its sector in view. `startsM` holds where each
 * sector starts; the first is 0.
 */
export const drawSectors = (
  chart: uPlot,
  startsM: number[],
  lengthM: number,
  labels: boolean
) => {
  if (startsM.length === 0) {
    return;
  }

  const { ctx, bbox } = chart;
  const pixelRatio = window.devicePixelRatio || 1;
  const edges = [...startsM, lengthM];
  const toX = (metres: number) => chart.valToPos(metres, 'x', true);
  const plotRight = bbox.left + bbox.width;

  ctx.save();

  startsM.forEach((startM, index) => {
    const from = Math.max(toX(startM), bbox.left);
    const to = Math.min(toX(edges[index + 1]), plotRight);

    if (to <= from) {
      return;
    }

    if (index % 2 === 1) {
      ctx.fillStyle = SHADE_COLOR;
      ctx.fillRect(from, bbox.top, to - from, bbox.height);
    }

    if (index > 0 && toX(startM) >= bbox.left) {
      ctx.strokeStyle = BOUNDARY_COLOR;
      ctx.lineWidth = pixelRatio;
      ctx.beginPath();
      ctx.moveTo(toX(startM), bbox.top);
      ctx.lineTo(toX(startM), bbox.top + bbox.height);
      ctx.stroke();
    }

    if (labels) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${LABEL_FONT_PX * pixelRatio}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `${SECTOR_PREFIX}${index + 1}`,
        (from + to) / 2,
        bbox.top + bbox.height + LABEL_DROP_PX * pixelRatio
      );
    }
  });

  ctx.restore();
};
