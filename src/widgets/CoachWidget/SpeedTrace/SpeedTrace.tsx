import { useCallback, useEffect, useRef } from 'react';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import { useReactiveCanvasLoop } from '@/hooks/widget/useReactiveCanvasLoop';
import {
  useCoachWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { TraceWindow } from '@store/widgets/coach-trace-utils';
import { drawSpeedTrace, type SpeedTraceColors } from './speed-trace-render';

import styles from './SpeedTrace.module.scss';

// Grid and the "now" marker are structural, not semantic — they stay neutral
// whatever the user picks for the gain/loss pair.
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const MARKER_COLOR = 'rgba(255, 255, 255, 0.45)';

// Not wrapped in observer() intentionally: useReactiveCanvasLoop subscribes to
// the store directly, so a React re-render per telemetry frame is not needed.
export const SpeedTrace = () => {
  const coachTrace = useCoachWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(
    (traceWindow: TraceWindow, colors: SpeedTraceColors) => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      drawSpeedTrace(canvas, traceWindow, colors);
    },
    []
  );

  useReactiveCanvasLoop(
    (scheduleDraw) => {
      const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

      // Read every drawn value inside the autorun so it is tracked: the paint
      // itself is deferred into requestAnimationFrame, outside the tracking
      // window, so a color change alone would otherwise never repaint.
      const colors: SpeedTraceColors = {
        reference: settings.referenceColor,
        gain: settings.gainColor,
        loss: settings.lossColor,
        grid: GRID_COLOR,
        marker: MARKER_COLOR,
      };

      const traceWindow = coachTrace.traceWindow;

      scheduleDraw(() => draw(traceWindow, colors));
    },
    [coachTrace, widgetSettings, draw]
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

      const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

      cancelAnimationFrame(resizeRafId);

      resizeRafId = requestAnimationFrame(() =>
        draw(coachTrace.traceWindow, {
          reference: settings.referenceColor,
          gain: settings.gainColor,
          loss: settings.lossColor,
          grid: GRID_COLOR,
          marker: MARKER_COLOR,
        })
      );
    });

    resizeObserver.observe(canvas.parentElement ?? canvas);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeRafId);
    };
  }, [coachTrace, widgetSettings, draw]);

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Speed against best lap"
      />
    </div>
  );
};
