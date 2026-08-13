import { useCallback, useRef } from 'react';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import { useReactiveCanvasLoop } from '@ui/hooks/useReactiveCanvasLoop';
import { useCanvasAutoResize } from '@ui/hooks/useCanvasAutoResize';
import {
  useCoachWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { drawSpeedTrace, type SpeedTraceColors } from './speed-trace-render';

import styles from './SpeedTrace.module.scss';

// Grid and the "now" marker are structural, not semantic — they stay neutral
// whatever the user picks for the gain/loss pair.
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const MARKER_COLOR = 'rgba(255, 255, 255, 0.45)';

const traceColors = (settings: CoachWidgetSettings): SpeedTraceColors => ({
  reference: settings.referenceColor,
  gain: settings.gainColor,
  loss: settings.lossColor,
  grid: GRID_COLOR,
  marker: MARKER_COLOR,
});

// Not wrapped in observer() intentionally: useReactiveCanvasLoop subscribes to
// the store directly, so a React re-render per telemetry frame is not needed.
// The window itself is built in the store on the telemetry frame — this
// component only paints the buffers it already holds.
export const SpeedTrace = () => {
  const coachTrace = useCoachWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(
    (
      channel: CoachWidgetSettings['traceChannel'],
      colors: SpeedTraceColors
    ) => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      drawSpeedTrace(
        canvas,
        coachTrace.window,
        coachTrace.windowStats,
        channel,
        colors
      );
    },
    [coachTrace]
  );

  useReactiveCanvasLoop(
    (scheduleDraw) => {
      const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

      // Read every drawn value inside the autorun so it is tracked: the paint
      // is deferred into requestAnimationFrame, outside the tracking window, so
      // a color change alone would otherwise never repaint.
      const colors = traceColors(settings);

      // The buffers are plain typed arrays; this tick is what makes the store's
      // per-frame refill visible to the loop.
      void coachTrace.frameTick;

      scheduleDraw(() => draw(settings.traceChannel, colors));
    },
    [coachTrace, widgetSettings, draw]
  );

  const redrawOnResize = useCallback(() => {
    const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

    draw(settings.traceChannel, traceColors(settings));
  }, [widgetSettings, draw]);

  useCanvasAutoResize(canvasRef, redrawOnResize);

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Speed against reference lap"
      />
    </div>
  );
};
