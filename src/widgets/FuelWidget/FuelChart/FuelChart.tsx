import { useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { drawBarChart, drawLineChart } from './chart-renderers';

import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelChart.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const FuelChart = observer(() => {
  const { fuel } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');
  const fuelHistory = fuel?.lapFuelHistory ?? [];

  // Read these in render so the observer tracks them — otherwise switching the
  // chart type (read only inside the effect) wouldn't trigger a redraw.
  const { showChart, chartType, barWidth } = settings;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || fuelHistory.length < 2) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const avg =
      fuelHistory.reduce((acc: number, val: number) => acc + val, 0) /
      fuelHistory.length;

    const dpr = window.devicePixelRatio || 1;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (chartType === 'bar') {
      drawBarChart(ctx, fuelHistory, width, height, avg, barWidth);
    } else {
      drawLineChart(ctx, fuelHistory, width, height, avg, barWidth);
    }
  });

  if (!showChart || fuelHistory.length < 2) {
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
