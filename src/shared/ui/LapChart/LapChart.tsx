import { useEffect, useRef, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import type { ChartViewport } from '@shared/lib/chart-viewport';
import { attachGestures, isHovered } from './chart-gestures';
import { drawSectors } from './chart-sectors';
import { writePlaque } from './chart-plaque';
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
  /** The stretch shown and the cursor, shared with the other charts and the map. */
  viewport: ChartViewport;
  /** Where each sector starts, metres; the first is 0. Empty for none. */
  sectorStartsM: number[];
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
/** The km labels, and the sector names under them. */
const X_AXIS_SIZE = 42;
const NO_AXIS_SIZE = 0;
/** Shows the viewport's stretch; y fits what is in it. */
const applyRange = (chart: uPlot, viewport: ChartViewport) => {
  const [min, max] = viewport.range ?? [0, viewport.lengthM];

  chart.setScale('x', { min, max });
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
  const {
    title,
    distances,
    series,
    height,
    showDistanceAxis,
    syncKey,
    viewport,
    tools,
  } = props;
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
          (chart) => {
            writePlaque(
              plaque,
              chart,
              latest.current.series,
              latest.current.props
            );

            if (isHovered(chart)) {
              const index = chart.cursor.idx;

              viewport.setCursor(
                index === null || index === undefined
                  ? null
                  : Number(chart.data[0][index]),
                'chart'
              );
            }
          },
        ],
        draw: [
          (chart) =>
            drawSectors(
              chart,
              latest.current.props.sectorStartsM,
              viewport.lengthM,
              showDistanceAxis
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
    applyRange(chart, viewport);

    const resizeObserver = new ResizeObserver(() => {
      chart.setSize({ width: host.clientWidth, height });
    });
    resizeObserver.observe(host);
    const detachGestures = attachGestures(chart, viewport);
    const stopRange = viewport.onRange(() => applyRange(chart, viewport));
    // The map's hover moves this chart's cursor; a chart's own hover
    // reaches the others through uPlot's sync.
    const stopCursor = viewport.onCursor((metres, source) => {
      if (source !== 'map') {
        return;
      }

      chart.setCursor({
        left: metres === null ? -1 : chart.valToPos(metres, 'x'),
        top: 0,
      });
    });

    return () => {
      stopCursor();
      stopRange();
      detachGestures();
      resizeObserver.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
    // Rebuilt only when the lines or the grid change; colours and
    // visibility are set on the chart below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, distances, height, showDistanceAxis, syncKey, viewport]);

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
      applyRange(chart, viewport);
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
