import { observer } from 'mobx-react-lite';
import {
  useWidgetInstanceId,
  useWidgetSettings,
} from '@entities/layout/useWidgetSettings';
import { useCallback, useRef } from 'react';

import { useReactiveCanvasLoop } from '@shared/hooks/useReactiveCanvasLoop';
import { useCanvasAutoResize } from '@shared/hooks/useCanvasAutoResize';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { formatSpeed } from '@shared/lib/telemetry-format';
import { writeStatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { useLiveWidgetsStore } from '@entities/layout/live-widgets-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
} from '@widgets/coach/coach-stores';
import { drawSpeedTrace, type SpeedTraceColors } from './speed-trace-render';

import styles from './SpeedTrace.module.scss';
import type { CoachWidgetSettings } from '../settings-schema';

// Grid and the "now" marker are structural, not semantic — they stay neutral
// whatever the user picks for the gain/loss pair.
const GRID_COLOR = 'rgba(250, 250, 250, 0.1)';
const MARKER_COLOR = 'rgba(255, 255, 255, 0.45)';

const NO_VALUE_TEXT = '—';

const traceColors = (settings: CoachWidgetSettings): SpeedTraceColors => ({
  reference: settings.referenceColor,
  gain: settings.gainColor,
  loss: settings.lossColor,
  grid: GRID_COLOR,
  marker: MARKER_COLOR,
  brake: settings.brakeColor,
  // The apex is where the reference lap is at its slowest — its own colour.
  apex: settings.referenceColor,
  throttle: settings.gasColor,
});

/** How far this lap's speed is off the reference's here, in whole display units. */
const speedGapText = (gap: number | null): string => {
  if (gap === null) {
    return NO_VALUE_TEXT;
  }

  const sign = gap > 0 ? '+' : gap < 0 ? '−' : '';

  return `${sign}${Math.abs(gap)}`;
};

const speedGapTone = (gap: number | null): StatChipTone => {
  if (gap === null || gap === 0) {
    return 'muted';
  }

  return gap > 0 ? 'positive' : 'danger';
};

// The window itself is built in the store on the telemetry frame — this
// component only paints the buffers it already holds.
export const SpeedTrace = observer(() => {
  const coachTrace = useCoachWidgetStore();
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();
  const liveWidgets = useLiveWidgetsStore();
  const instanceId = useWidgetInstanceId('coach');
  const settings = useWidgetSettings<CoachWidgetSettings>('coach');

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
      const settings = liveWidgets.getSettings<CoachWidgetSettings>(instanceId);

      // Read every drawn value inside the autorun so it is tracked: the paint
      // is deferred into requestAnimationFrame, outside the tracking window, so
      // a color change alone would otherwise never repaint.
      const colors = traceColors(settings);

      // The buffers are plain typed arrays; this tick is what makes the store's
      // per-frame refill visible to the loop.
      void coachTrace.frameTick;

      scheduleDraw(() => draw(settings.traceChannel, colors));
    },
    [coachTrace, liveWidgets, draw]
  );

  // The gap moves with the car, so it is written straight to its chip. It is
  // the gap of the two figures as the footer shows them, so the three always
  // add up.
  const speedGapRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const referenceSpeedMps = coach.referenceSpeedMps;
      const gap =
        referenceSpeedMps === null
          ? null
          : Number(formatSpeed(coach.currentSpeedMps, units.unitSystem)) -
            Number(formatSpeed(referenceSpeedMps, units.unitSystem));
      const tone = speedGapTone(gap);
      const text = speedGapText(gap);

      scheduleWrite(() => {
        writeStatChip(element, tone, 'number', text, 'reading');
      });
    },
    [coach, units]
  );

  const redrawOnResize = useCallback(() => {
    const settings = liveWidgets.getSettings<CoachWidgetSettings>(instanceId);

    draw(settings.traceChannel, traceColors(settings));
  }, [liveWidgets, instanceId, draw]);

  useCanvasAutoResize(canvasRef, redrawOnResize);

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Speed against reference lap"
      />

      {settings.showSpeed ? (
        <div className={styles.speedGap}>
          <span ref={speedGapRef} />
        </div>
      ) : null}
    </div>
  );
});
