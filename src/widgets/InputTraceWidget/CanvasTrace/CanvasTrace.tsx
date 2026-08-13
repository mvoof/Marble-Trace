import { useRef, useCallback } from 'react';

import type { InputTraceSettings } from '@/types/widget-settings';
import { useReactiveCanvasLoop } from '@/hooks/useReactiveCanvasLoop';
import { useCanvasAutoResize } from '@/hooks/useCanvasAutoResize';
import styles from './CanvasTrace.module.scss';
import {
  useAppSettingsStore,
  useInputTraceWidgetStore,
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  createTraceBufferState,
  drawInputTrace,
  ensureTraceBuffers,
  pushTraceSample,
  type TraceBufferState,
} from './canvas-trace-render';

// No frame has been consumed yet; the store's tick starts at 0 and reset()
// returns it there, so the sentinel must sit outside that range.
const NO_FRAME_CONSUMED = -1;

// Not wrapped in observer() intentionally: useReactiveCanvasLoop subscribes to
// MobX observables directly, so React re-renders are not needed for data updates.
// observer() would cause 60 Hz React re-renders on every carInputs change.
export const CanvasTrace = () => {
  const telemetry = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();
  const inputTrace = useInputTraceWidgetStore();
  const appSettings = useAppSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferStateRef = useRef<TraceBufferState | null>(null);
  const lastFrameTickRef = useRef(NO_FRAME_CONSUMED);

  bufferStateRef.current ??= createTraceBufferState();

  const draw = useCallback(
    (settings: InputTraceSettings, steeringLockDeg: number) => {
      const canvas = canvasRef.current;
      const state = bufferStateRef.current;

      if (!canvas || !state) return;

      drawInputTrace(canvas, state, settings, steeringLockDeg);
    },
    []
  );

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
        steeringZoom: _steeringZoom,
      } = settings;

      // Read inside the autorun for the same reason: the lock lives in app
      // settings, and changing it must repaint the steering trace.
      const steeringLockDeg = appSettings.appSettings.steeringLock;

      const smoothed = inputTrace.smoothed;

      ensureTraceBuffers(state, settings);

      // This autorun runs more than once per telemetry frame: `carDynamics`
      // and `carInputs` land in the same bundle action, and the store's
      // smoothing reaction then writes `smoothed` from inside the same MobX
      // flush, re-invalidating an autorun pass that already completed. Settings
      // edits re-run it too. Appending on every pass would push ~2 samples per
      // frame and halve the configured `historySeconds`, so the append is gated
      // on the store's per-frame tick while the repaint below still happens.
      const { frameTick } = inputTrace;

      if (frameTick !== lastFrameTickRef.current) {
        lastFrameTickRef.current = frameTick;

        pushTraceSample(
          state,
          {
            throttle: smoothed.throttle,
            brake: smoothed.brake,
            clutch: smoothed.clutch,
            absActive: !!inputs?.brake_abs_active,
            steeringWheelAngle:
              telemetry.carDynamics?.steering_wheel_angle ?? 0,
          },
          settings
        );
      }

      scheduleDraw(() => draw(settings, steeringLockDeg));
    },
    [telemetry, widgetSettings, inputTrace, appSettings, draw]
  );

  const redrawOnResize = useCallback(() => {
    const currentSettings =
      widgetSettings.getSettings<InputTraceSettings>('input-trace');

    draw(currentSettings, appSettings.appSettings.steeringLock);
  }, [widgetSettings, appSettings, draw]);

  useCanvasAutoResize(canvasRef, redrawOnResize);

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
