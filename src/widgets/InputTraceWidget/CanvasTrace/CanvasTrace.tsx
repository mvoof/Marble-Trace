import { useEffect, useRef, useCallback } from 'react';
import { autorun } from 'mobx';

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

// Not wrapped in observer() intentionally: autorun() inside useEffect subscribes
// to MobX observables directly, so React re-renders are not needed for data updates.
// observer() would cause 60 Hz React re-renders on every carInputs change.
export const CanvasTrace = () => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const bufferStateRef = useRef({
    buffer: new Float32Array(0),
    absBuffer: new Uint8Array(0),
    steerBuffer: new Float32Array(0),
    head: 0,
    count: 0,
    smoothed: { throttle: 0, brake: 0, clutch: 0 } as SmoothedValues,
  });

  const draw = useCallback((settings: InputTraceSettings) => {
    const canvas = canvasRef.current;
    const { buffer, absBuffer, steerBuffer, head, count } =
      bufferStateRef.current;

    if (!canvas || (buffer.length === 0 && !settings.showSteering)) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    const channels: { color: string; type: 'throttle' | 'brake' | 'clutch' }[] =
      [];

    if (settings.showThrottle) {
      channels.push({ color: settings.throttleColor, type: 'throttle' });
    }

    if (settings.showBrake) {
      channels.push({ color: settings.brakeColor, type: 'brake' });
    }

    if (settings.showClutch) {
      channels.push({ color: settings.clutchColor, type: 'clutch' });
    }

    ctx.clearRect(0, 0, logicalW, logicalH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let gridIndex = 1; gridIndex <= 3; gridIndex++) {
      const yPos = logicalH * (gridIndex / 4);

      ctx.moveTo(0, yPos);
      ctx.lineTo(logicalW, yPos);
    }

    ctx.stroke();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const bufferSize = settings.historySeconds * 60;

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      const channel = channels[channelIndex];

      ctx.lineWidth = settings.lineWidth;

      if (channel.type === 'brake') {
        let currentAbs = false;

        ctx.strokeStyle = settings.brakeColor;
        ctx.beginPath();

        let started = false;

        for (let sampleIndex = 0; sampleIndex < count; sampleIndex++) {
          const circularIndex =
            (head - count + sampleIndex + bufferSize) % bufferSize;

          const sampleValue =
            buffer[circularIndex * channels.length + channelIndex];

          const xPos = (sampleIndex / (bufferSize - 1)) * logicalW;
          const yPos = logicalH - sampleValue * logicalH;

          const sampleAbs = absBuffer[circularIndex] === 1;

          if (started && sampleAbs !== currentAbs) {
            ctx.lineTo(xPos, yPos);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(xPos, yPos);
            ctx.strokeStyle = sampleAbs
              ? settings.absColor
              : settings.brakeColor;
            currentAbs = sampleAbs;
          }

          if (!started) {
            ctx.strokeStyle = sampleAbs
              ? settings.absColor
              : settings.brakeColor;
            currentAbs = sampleAbs;
            ctx.moveTo(xPos, yPos);
            started = true;
          } else {
            ctx.lineTo(xPos, yPos);
          }
        }

        ctx.stroke();
      } else {
        ctx.strokeStyle = channel.color;
        ctx.beginPath();

        let started = false;

        for (let sampleIndex = 0; sampleIndex < count; sampleIndex++) {
          const circularIndex =
            (head - count + sampleIndex + bufferSize) % bufferSize;

          const sampleValue =
            buffer[circularIndex * channels.length + channelIndex];

          const xPos = (sampleIndex / (bufferSize - 1)) * logicalW;
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
    }

    if (settings.showSteering) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = settings.lineWidth;
      ctx.beginPath();

      let started = false;
      const MAX_STEER_RAD = ((settings.steeringLimit / 2) * Math.PI) / 180;

      for (let sampleIndex = 0; sampleIndex < count; sampleIndex++) {
        const circularIndex =
          (head - count + sampleIndex + bufferSize) % bufferSize;

        const rawSteer = steerBuffer[circularIndex] ?? 0;
        const u = Math.max(-1, Math.min(1, rawSteer / MAX_STEER_RAD));

        const xPos = (sampleIndex / (bufferSize - 1)) * logicalW;
        const yPos = logicalH / 2 - u * (logicalH / 2);

        if (!started) {
          ctx.moveTo(xPos, yPos);
          started = true;
        } else {
          ctx.lineTo(xPos, yPos);
        }
      }

      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const disposer = autorun(() => {
      const inputs = telemetry.carInputs;
      const settings =
        widgetSettings.getSettings<InputTraceSettings>('input-trace');

      const rawThrottle = inputs?.throttle ?? 0;
      const rawBrake = inputs?.brake ?? 0;
      const rawClutch = inputs?.clutch != null ? 1 - inputs.clutch : 0;

      const bufferSize = settings.historySeconds * 60;
      const numChannels =
        (settings.showThrottle ? 1 : 0) +
        (settings.showBrake ? 1 : 0) +
        (settings.showClutch ? 1 : 0);

      const requiredBufferLength = bufferSize * numChannels;
      const state = bufferStateRef.current;

      if (state.buffer.length !== requiredBufferLength) {
        state.buffer = new Float32Array(requiredBufferLength);
        state.head = 0;
        state.count = 0;
      }

      if (state.absBuffer.length !== bufferSize) {
        state.absBuffer = new Uint8Array(bufferSize);
      }

      if (state.steerBuffer.length !== bufferSize) {
        state.steerBuffer = new Float32Array(bufferSize);
      }

      const smoothing = settings.smoothing;
      const previous = state.smoothed;

      if (smoothing <= 0) {
        state.smoothed = {
          throttle: rawThrottle,
          brake: rawBrake,
          clutch: rawClutch,
        };
      } else {
        state.smoothed = {
          throttle:
            (previous.throttle * smoothing + rawThrottle) / (smoothing + 1),
          brake: (previous.brake * smoothing + rawBrake) / (smoothing + 1),
          clutch: (previous.clutch * smoothing + rawClutch) / (smoothing + 1),
        };
      }

      const { throttle, brake, clutch } = state.smoothed;
      const values: number[] = [];

      if (settings.showThrottle) values.push(throttle);

      if (settings.showBrake) values.push(brake);

      if (settings.showClutch) values.push(clutch);

      const offset = state.head * values.length;

      for (let channelIndex = 0; channelIndex < values.length; channelIndex++) {
        state.buffer[offset + channelIndex] = values[channelIndex] ?? 0;
      }

      state.absBuffer[state.head] = inputs?.brake_abs_active ? 1 : 0;
      state.steerBuffer[state.head] =
        telemetry.carDynamics?.steering_wheel_angle ?? 0;

      state.head = (state.head + 1) % bufferSize;

      if (state.count < bufferSize) {
        state.count++;
      }

      cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => draw(settings));
    });

    return () => {
      disposer();
      cancelAnimationFrame(rafRef.current);
    };
  }, [telemetry, widgetSettings, draw]);

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

      const currentSettings =
        widgetSettings.getSettings<InputTraceSettings>('input-trace');

      cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => draw(currentSettings));
    });

    resizeObserver.observe(canvas.parentElement ?? canvas);

    return () => resizeObserver.disconnect();
  }, [widgetSettings, draw]);

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Input trace"
      />
    </div>
  );
};
