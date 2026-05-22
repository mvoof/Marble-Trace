import { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { observer } from 'mobx-react-lite';

import type { InputTraceSettings } from '@/types/widget-settings';
import styles from './CanvasTrace.module.scss';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface SmoothedValues {
  throttle: number;
  brake: number;
  clutch: number;
}

export const CanvasTrace = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');
  const frame = telemetry.carInputs;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rafRef = useRef<number>(0);
  const headRef = useRef(0);
  const countRef = useRef(0);

  const smoothedRef = useRef<SmoothedValues>({
    throttle: 0,
    brake: 0,
    clutch: 0,
  });

  const bufferSize = settings.historySeconds * 60;
  const numChannels =
    (settings.showThrottle ? 1 : 0) +
    (settings.showBrake ? 1 : 0) +
    (settings.showClutch ? 1 : 0);

  const bufferRef = useRef<Float32Array | null>(null);

  if (
    !bufferRef.current ||
    bufferRef.current.length !== bufferSize * numChannels
  ) {
    bufferRef.current = new Float32Array(bufferSize * numChannels);
    headRef.current = 0;
    countRef.current = 0;
  }

  const channelColorsRef = useRef<string[]>([]);
  channelColorsRef.current = [];
  if (settings.showThrottle)
    channelColorsRef.current.push(settings.throttleColor);

  if (settings.showBrake) channelColorsRef.current.push(settings.brakeColor);

  if (settings.showClutch) channelColorsRef.current.push(settings.clutchColor);

  const lineWidthRef = useRef(settings.lineWidth);

  lineWidthRef.current = settings.lineWidth;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || !bufferRef.current) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    const buffer = bufferRef.current;
    const channels = channelColorsRef.current;

    const currentCount = countRef.current;
    const currentBufferSize = bufferSize;

    ctx.clearRect(0, 0, logicalW, logicalH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;

    for (let gridIndex = 1; gridIndex <= 3; gridIndex++) {
      const yPos = logicalH * (gridIndex / 4);

      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(logicalW, yPos);
      ctx.stroke();
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      ctx.strokeStyle = channels[channelIndex] ?? '#ffffff';
      ctx.lineWidth = lineWidthRef.current;
      ctx.beginPath();

      let started = false;

      for (let sampleIndex = 0; sampleIndex < currentCount; sampleIndex++) {
        const circularIndex =
          (headRef.current - currentCount + sampleIndex + currentBufferSize) %
          currentBufferSize;

        const sampleValue =
          buffer[circularIndex * channels.length + channelIndex];

        const xPos = (sampleIndex / (currentBufferSize - 1)) * logicalW;
        const yPos = logicalH - sampleValue * logicalH;

        if (!started) {
          ctx.moveTo(xPos, yPos);

          started = true;
        } else {
          ctx.lineTo(xPos, yPos);
        }
      }

      ctx.stroke();
    }
  }, [bufferSize]);

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => draw());
  }, [draw]);

  useLayoutEffect(() => {
    const rawThrottle = frame?.throttle ?? 0;
    const rawBrake = frame?.brake ?? 0;
    const rawClutch = frame?.clutch != null ? 1 - frame.clutch : 0;

    const smoothing = settings.smoothing;
    const previous = smoothedRef.current;

    if (smoothing <= 0) {
      smoothedRef.current = {
        throttle: rawThrottle,
        brake: rawBrake,
        clutch: rawClutch,
      };
    } else {
      smoothedRef.current = {
        throttle:
          (previous.throttle * smoothing + rawThrottle) / (smoothing + 1),
        brake: (previous.brake * smoothing + rawBrake) / (smoothing + 1),
        clutch: (previous.clutch * smoothing + rawClutch) / (smoothing + 1),
      };
    }

    const { throttle, brake, clutch } = smoothedRef.current;
    const values: number[] = [];

    if (settings.showThrottle) values.push(throttle);
    if (settings.showBrake) values.push(brake);
    if (settings.showClutch) values.push(clutch);

    if (!bufferRef.current) return;

    const channels = channelColorsRef.current;
    const offset = headRef.current * channels.length;

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      bufferRef.current[offset + channelIndex] = values[channelIndex] ?? 0;
    }

    headRef.current = (headRef.current + 1) % bufferSize;

    if (countRef.current < bufferSize) {
      countRef.current++;
    }

    scheduleDraw();
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        const { width, height } = entry.contentRect;

        if (width <= 0 || height <= 0) return;

        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      scheduleDraw();
    });

    resizeObserver.observe(canvas.parentElement ?? canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);

      resizeObserver.disconnect();
    };
  }, [scheduleDraw]);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
});
