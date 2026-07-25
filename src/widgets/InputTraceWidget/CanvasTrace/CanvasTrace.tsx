import { useEffect, useRef, useCallback } from 'react';

import type { InputTraceSettings } from '@/types/widget-settings';
import { useReactiveCanvasLoop } from '@/hooks/widget/useReactiveCanvasLoop';
import styles from './CanvasTrace.module.scss';
import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  createTraceBufferState,
  drawInputTrace,
  pushTraceSample,
  type TraceBufferState,
} from './canvas-trace-render';

// Not wrapped in observer() intentionally: useReactiveCanvasLoop subscribes to
// MobX observables directly, so React re-renders are not needed for data updates.
// observer() would cause 60 Hz React re-renders on every carInputs change.
export const CanvasTrace = () => {
  const telemetry = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferStateRef = useRef<TraceBufferState | null>(null);

  bufferStateRef.current ??= createTraceBufferState();

  const draw = useCallback((settings: InputTraceSettings) => {
    const canvas = canvasRef.current;
    const state = bufferStateRef.current;

    if (!canvas || !state) return;

    drawInputTrace(canvas, state, settings);
  }, []);

  useReactiveCanvasLoop(
    (scheduleDraw) => {
      const inputs = telemetry.carInputs;
      const settings =
        widgetSettings.getSettings<InputTraceSettings>('input-trace');
      const state = bufferStateRef.current;

      if (!state) return;

      // Touch every field drawInputTrace() reads so autorun tracks them as
      // dependencies — the draw itself runs deferred inside requestAnimationFrame,
      // outside the autorun's synchronous tracking window, so settings-only
      // changes (no telemetry update, e.g. the static widget preview) would
      // otherwise never trigger a redraw.
      const {
        lineWidth: _lineWidth,
        throttleColor: _throttleColor,
        brakeColor: _brakeColor,
        clutchColor: _clutchColor,
        absColor: _absColor,
        showSteering: _showSteering,
        steeringLimit: _steeringLimit,
        steeringZoom: _steeringZoom,
      } = settings;

      pushTraceSample(
        state,
        {
          throttle: inputs?.throttle ?? 0,
          brake: inputs?.brake ?? 0,
          clutch: inputs?.clutch != null ? 1 - inputs.clutch : 0,
          absActive: !!inputs?.brake_abs_active,
          steeringWheelAngle: telemetry.carDynamics?.steering_wheel_angle ?? 0,
        },
        settings
      );

      scheduleDraw(() => draw(settings));
    },
    [telemetry, widgetSettings, draw]
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let resizeRafId = 0;

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

      cancelAnimationFrame(resizeRafId);

      resizeRafId = requestAnimationFrame(() => draw(currentSettings));
    });

    resizeObserver.observe(canvas.parentElement ?? canvas);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeRafId);
    };
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
