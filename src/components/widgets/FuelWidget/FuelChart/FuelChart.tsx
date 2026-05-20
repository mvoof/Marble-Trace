import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { drawBarChart, drawLineChart } from './chart-renderers';

import styles from './FuelChart.module.scss';

export const FuelChart = observer(() => {
  const settings = widgetSettingsStore.getFuelSettings();
  const history = computedStore.fuel?.lapFuelHistory ?? [];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || history.length < 2) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const avg = history.reduce((acc, val) => acc + val, 0) / history.length;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (settings.chartType === 'bar') {
      drawBarChart(ctx, history, width, height, avg, settings.barWidth);
    } else {
      drawLineChart(ctx, history, width, height, avg, settings.barWidth);
    }
  }, [history, settings.chartType, settings.barWidth]);

  if (!settings.showChart || history.length < 2) {
    return null;
  }

  return (
    <div className={styles.chartSection}>
      <canvas ref={canvasRef} className={styles.chartCanvas} />
    </div>
  );
});
