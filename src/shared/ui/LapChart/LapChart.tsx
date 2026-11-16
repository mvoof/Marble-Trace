import { useEffect, useRef, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import styles from './LapChart.module.scss';

/** One line: a lap's values on the chart's distance grid. */
export interface ChartSeries {
  key: string;
  color: string;
  visible: boolean;
  values: ArrayLike<number>;
}

interface LapChartProps {
  title: string;
  /** The grid, metres from the line. */
  distances: ArrayLike<number>;
  series: ChartSeries[];
  height: number;
  /** The distance axis: on the bottom chart only. */
  showDistanceAxis: boolean;
  /** Charts sharing it move one cursor. */
  syncKey: string;
  formatValue: (value: number) => string;
  /** The plaque's distance. */
  formatDistance: (metres: number) => string;
  /** The axis' tick labels. */
  formatAxisDistance: (metres: number) => string;
  /** Controls at the top right: remove, move. */
  tools?: ReactNode;
}

const LINE_WIDTH = 1;
const AXIS_FONT = '11px Inter, system-ui, sans-serif';
const AXIS_COLOR = '#5e626d';
const GRID_COLOR = '#2a2c32';
const GRID_DASH = [3, 3];
const Y_AXIS_SIZE = 48;
const X_AXIS_SIZE = 28;
const NO_AXIS_SIZE = 0;
/** Between the cursor line and its plaque, CSS pixels. */
const PLAQUE_GAP = 10;

/** The plaque by the cursor: the distance, then each shown lap's value. */
const writePlaque = (
  plaque: HTMLDivElement,
  chart: uPlot,
  series: ChartSeries[],
  props: Pick<LapChartProps, 'formatValue' | 'formatDistance'>
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

const chartData = (
  distances: ArrayLike<number>,
  series: ChartSeries[]
): uPlot.AlignedData => [
  Array.from(distances),
  ...series.map((line) => Array.from(line.values)),
];

/**
 * A distance chart of laps on uPlot's canvas. The cursor and its plaque are
 * drawn by uPlot's own hooks: moving the mouse renders nothing in React.
 */
export const LapChart = observer((props: LapChartProps) => {
  const { title, distances, series, height, showDistanceAxis, syncKey, tools } =
    props;
  const hostRef = useRef<HTMLDivElement>(null);
  const plaqueRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  // The hooks read the latest props without the chart being rebuilt.
  const latest = useRef({ series, props });
  latest.current = { series, props };

  const structure = series.map((line) => line.key).join('|');

  useEffect(() => {
    const host = hostRef.current;
    const plaque = plaqueRef.current;

    if (host === null || plaque === null) {
      return;
    }

    const options: uPlot.Options = {
      width: host.clientWidth,
      height,
      legend: { show: false },
      cursor: {
        y: false,
        points: { show: false },
        drag: { x: false, y: false },
        sync: { key: syncKey },
      },
      scales: { x: { time: false } },
      axes: [
        {
          show: showDistanceAxis,
          size: showDistanceAxis ? X_AXIS_SIZE : NO_AXIS_SIZE,
          font: AXIS_FONT,
          stroke: AXIS_COLOR,
          grid: { show: false },
          ticks: { show: false },
          values: (_chart, ticks) =>
            ticks.map((metres) =>
              latest.current.props.formatAxisDistance(metres)
            ),
        },
        {
          size: Y_AXIS_SIZE,
          font: AXIS_FONT,
          stroke: AXIS_COLOR,
          grid: { stroke: GRID_COLOR, width: 1, dash: GRID_DASH },
          ticks: { show: false },
        },
      ],
      series: [
        {},
        ...latest.current.series.map((line) => ({
          stroke: line.color,
          width: LINE_WIDTH,
          show: line.visible,
          points: { show: false },
        })),
      ],
      hooks: {
        setCursor: [
          (chart) =>
            writePlaque(
              plaque,
              chart,
              latest.current.series,
              latest.current.props
            ),
        ],
      },
    };
    const chart = new uPlot(
      options,
      chartData(distances, latest.current.series),
      host
    );
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      chart.setSize({ width: host.clientWidth, height });
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
    // Rebuilt only when the lines or the grid change; colours and
    // visibility are set on the chart below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, distances, height, showDistanceAxis, syncKey]);

  // New values for the same lines: no rebuild, the data swapped in.
  const shownValues = useRef(series.map((line) => line.values));

  useEffect(() => {
    const chart = chartRef.current;
    const values = series.map((line) => line.values);
    const changed = values.some(
      (lineValues, index) => lineValues !== shownValues.current[index]
    );

    shownValues.current = values;

    if (chart !== null && changed) {
      chart.setData(chartData(distances, series));
    }
  });

  // A colour or an eye changed: repaint, nothing reloaded.
  const looks = series.map((line) => `${line.color}:${line.visible}`).join('|');

  useEffect(() => {
    const chart = chartRef.current;

    if (chart === null) {
      return;
    }

    latest.current.series.forEach((line, index) => {
      const chartSeries = chart.series[index + 1];

      chartSeries.stroke = () => line.color;

      if (chartSeries.show !== line.visible) {
        chart.setSeries(index + 1, { show: line.visible });
      }
    });
    chart.redraw(false);
  }, [looks]);

  return (
    <div className={styles.card}>
      <span className={styles.title}>{title}</span>

      {tools !== undefined && <div className={styles.tools}>{tools}</div>}

      <div ref={hostRef} className={styles.host} />

      <div ref={plaqueRef} className={styles.plaque} hidden />
    </div>
  );
});
