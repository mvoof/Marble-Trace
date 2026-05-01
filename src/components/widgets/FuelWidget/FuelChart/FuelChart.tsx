import { useEffect, useRef } from 'react';
import { drawBarChart, drawLineChart } from './chart-renderers';

import styles from '../FuelWidget.module.scss';

interface FuelChartProps {
  history: number[];
  chartType: 'line' | 'bar';
}

export const FuelChart = ({ history, chartType }: FuelChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (chartType === 'bar') {
      drawBarChart(ctx, history, w, h, avg);
    } else {
      drawLineChart(ctx, history, w, h, avg);
    }
  }, [history, chartType]);

  return <canvas ref={canvasRef} className={styles.chartCanvas} />;
};
