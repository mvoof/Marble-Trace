import { useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { drawBarChart, drawLineChart } from './chart-renderers';

import styles from './FuelChart.module.scss';

export const FuelChart = observer(() => {
  const settings = widgetSettingsStore.getFuelSettings();
  const history = computedStore.fuel?.lapFuelHistory ?? [];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const currentHistory = computedStore.fuel?.lapFuelHistory ?? [];
    const currentSettings = widgetSettingsStore.getFuelSettings();

    if (!canvas || currentHistory.length < 2) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const avg =
      currentHistory.reduce((acc: number, val: number) => acc + val, 0) /
      currentHistory.length;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (currentSettings.chartType === 'bar') {
      drawBarChart(
        ctx,
        currentHistory,
        width,
        height,
        avg,
        currentSettings.barWidth
      );
    } else {
      drawLineChart(
        ctx,
        currentHistory,
        width,
        height,
        avg,
        currentSettings.barWidth
      );
    }
  });

  if (!settings.showChart || history.length < 2) {
    return null;
  }

  return (
    <div className={styles.chartSection}>
      <canvas ref={canvasRef} className={styles.chartCanvas} />
    </div>
  );
});
