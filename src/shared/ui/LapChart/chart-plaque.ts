import type uPlot from 'uplot';

import type { ChartSeries } from './LapChart';
import styles from './LapChart.module.scss';

/** Between the cursor line and its plaque, CSS pixels. */
const PLAQUE_GAP = 10;

/** The plaque by the cursor: the distance, then each shown lap's value. */
export const writePlaque = (
  plaque: HTMLDivElement,
  chart: uPlot,
  series: ChartSeries[],
  props: {
    formatValue: (value: number) => string;
    formatDistance: (metres: number) => string;
  }
) => {
  const index = chart.cursor.idx;
  const left = chart.cursor.left ?? -1;

  if (index === null || index === undefined || left < 0) {
    plaque.hidden = true;

    return;
  }

  const rows: HTMLElement[] = [];
  const distanceRow = document.createElement('div');
  distanceRow.className = styles.plaqueDistance;
  distanceRow.textContent = props.formatDistance(Number(chart.data[0][index]));
  rows.push(distanceRow);

  series.forEach((line) => {
    const value = line.values[index];

    if (!line.visible || value === undefined || !Number.isFinite(value)) {
      return;
    }

    const row = document.createElement('div');
    row.style.color = line.color;
    row.textContent = props.formatValue(value);
    rows.push(row);
  });

  plaque.replaceChildren(...rows);
  plaque.hidden = false;

  const overWidth = chart.over.clientWidth;
  const flips = left + PLAQUE_GAP + plaque.offsetWidth > overWidth;
  const plotLeft = chart.over.offsetLeft;

  plaque.style.left = `${plotLeft + (flips ? left - PLAQUE_GAP - plaque.offsetWidth : left + PLAQUE_GAP)}px`;
};
