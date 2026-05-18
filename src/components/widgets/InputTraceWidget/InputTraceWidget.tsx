import { useEffect, useRef } from 'react';
import { autorun, untracked } from 'mobx';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import {
  CanvasTrace,
  type CanvasTraceChannel,
  type CanvasTraceHandle,
} from '../../shared/primitives/CanvasTrace/CanvasTrace';
import { InputBars, type InputBarsHandle } from './InputBars/InputBars';

import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  const barsRef = useRef<InputBarsHandle>(null);
  const canvasTraceRef = useRef<CanvasTraceHandle>(null);
  const valuesRef = useRef<number[]>([]);

  const smoothedThrottle = useRef(0);
  const smoothedBrake = useRef(0);
  const smoothedClutch = useRef(0);

  useEffect(() => {
    return autorun(() => {
      const frame = telemetryStore.carInputs;

      if (!frame) {
        return;
      }

      const rawThrottle = frame.throttle ?? 0;
      const rawBrake = frame.brake ?? 0;
      const rawClutch = frame.clutch != null ? 1 - frame.clutch : 0;
      const smoothing = settings.smoothing;

      if (smoothing <= 0) {
        smoothedThrottle.current = rawThrottle;
        smoothedBrake.current = rawBrake;
        smoothedClutch.current = rawClutch;
      } else {
        smoothedThrottle.current =
          (smoothedThrottle.current * smoothing + rawThrottle) /
          (smoothing + 1);
        smoothedBrake.current =
          (smoothedBrake.current * smoothing + rawBrake) / (smoothing + 1);
        smoothedClutch.current =
          (smoothedClutch.current * smoothing + rawClutch) / (smoothing + 1);
      }

      barsRef.current?.update(
        smoothedThrottle.current,
        smoothedBrake.current,
        smoothedClutch.current
      );

      const values = valuesRef.current;
      values.length = 0;

      if (settings.showThrottle) {
        values.push(smoothedThrottle.current);
      }

      if (settings.showBrake) {
        values.push(smoothedBrake.current);
      }

      if (settings.showClutch) {
        values.push(smoothedClutch.current);
      }

      canvasTraceRef.current?.pushSample(values);
    });
  }, [
    settings.showThrottle,
    settings.showBrake,
    settings.showClutch,
    settings.smoothing,
  ]);

  const initialFrame = untracked(() => telemetryStore.carInputs);
  const initialThrottle = initialFrame?.throttle ?? 0;
  const initialBrake = initialFrame?.brake ?? 0;
  const initialClutch =
    initialFrame?.clutch != null ? 1 - initialFrame.clutch : 0;

  const channels: CanvasTraceChannel[] = [];

  if (settings.showThrottle) {
    channels.push({ value: initialThrottle, color: settings.throttleColor });
  }

  if (settings.showBrake) {
    channels.push({ value: initialBrake, color: settings.brakeColor });
  }

  if (settings.showClutch) {
    channels.push({ value: initialClutch, color: settings.clutchColor });
  }

  const showBars = settings.barMode !== 'hidden';
  const isVertical = settings.barMode === 'vertical';

  return (
    <WidgetPanel direction={isVertical ? 'row' : 'column'} gap={8} edgeInset>
      {isVertical ? (
        <>
          <div className={styles.chartArea}>
            <CanvasTrace
              ref={canvasTraceRef}
              channels={channels}
              lineWidth={settings.lineWidth}
              bufferSize={settings.historySeconds * 60}
            />
          </div>

          {showBars && (
            <InputBars
              ref={barsRef}
              throttle={initialThrottle}
              brake={initialBrake}
              clutch={initialClutch}
              settings={settings}
              isVertical
            />
          )}
        </>
      ) : (
        <>
          {showBars && (
            <InputBars
              ref={barsRef}
              throttle={initialThrottle}
              brake={initialBrake}
              clutch={initialClutch}
              settings={settings}
              isVertical={false}
            />
          )}

          <div className={styles.chartArea}>
            <CanvasTrace
              ref={canvasTraceRef}
              channels={channels}
              lineWidth={settings.lineWidth}
              bufferSize={settings.historySeconds * 60}
            />
          </div>
        </>
      )}
    </WidgetPanel>
  );
});
