import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { drawBarChart, drawLineChart } from './chart-renderers';
import { countedLaps } from '../fuel-utils';
import { resizeCanvasToDpr } from '@utils/canvas';

import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelChart.module.scss';
import { useBackendComputedStore } from '@store/root-store-context';

export const FuelChart = observer(() => {
  const { fuel } = useBackendComputedStore();

  const settings = useWidgetSettings<FuelWidgetSettings>('fuel');
  // Keep the raw reference (undefined or a stable array per fuel frame) so the
  // effect's dep is stable — `?? []` would allocate a new array every render.
  const fuelHistory = fuel?.lapFuelHistory;

  // Read these in render so the observer tracks them — otherwise switching the
  // chart type (read only inside the effect) wouldn't trigger a redraw.
  const { showChart, chartType, barWidth } = settings;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !fuelHistory || fuelHistory.length < 2) {
      return;
    }

    // Only the laps that count set the AVG line — it has to sit where the
    // widget's own average sits, not where the drawn bars happen to average.
    const counted = countedLaps(fuelHistory);

    const avg =
      counted.length > 0
        ? counted.reduce((sum, record) => sum + record.used, 0) / counted.length
        : null;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const ctx = resizeCanvasToDpr(canvas, width, height);

    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);

    if (chartType === 'bar') {
      drawBarChart(ctx, fuelHistory, width, height, avg, barWidth);
    } else {
      drawLineChart(ctx, fuelHistory, width, height, avg, barWidth);
    }
    // Redraw only when the history array (new reference per 4 Hz fuel-frame
    // update — captures value changes, not just length) or chart settings change.
  }, [fuelHistory, chartType, barWidth]);

  if (!showChart || !fuelHistory || fuelHistory.length < 2) {
    return null;
  }

  return (
    <div className={styles.chartSection}>
      <canvas
        ref={canvasRef}
        className={styles.chartCanvas}
        aria-label="Fuel chart"
      />
    </div>
  );
});
