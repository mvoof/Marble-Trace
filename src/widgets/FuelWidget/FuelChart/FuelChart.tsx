import { useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { drawBarChart, drawLineChart } from './chart-renderers';

import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelChart.module.scss';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const FuelChart = observer(() => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');
  const history = computed.fuel?.lapFuelHistory ?? [];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const currentHistory = computed.fuel?.lapFuelHistory ?? [];
    const currentSettings =
      widgetSettings.getSettings<FuelWidgetSettings>('fuel');

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
