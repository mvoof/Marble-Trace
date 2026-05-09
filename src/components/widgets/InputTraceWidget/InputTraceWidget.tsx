import { forwardRef, useImperativeHandle, useRef } from 'react';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { CanvasTrace } from '../primitives/CanvasTrace';
import type {
  CanvasTraceChannel,
  CanvasTraceHandle,
} from '../primitives/CanvasTrace';
import type { InputTraceSettings } from '../../../types/widget-settings';
import { InputBars, type InputBarsHandle } from './InputBars/InputBars';

import styles from './InputTraceWidget.module.scss';

export interface InputTraceHandle {
  update: (throttle: number, brake: number, clutch: number) => void;
}

interface InputTraceWidgetProps {
  initialThrottle: number;
  initialBrake: number;
  initialClutch: number;
  settings: InputTraceSettings;
}

export const InputTraceWidget = forwardRef<
  InputTraceHandle,
  InputTraceWidgetProps
>(({ initialThrottle, initialBrake, initialClutch, settings }, ref) => {
  const barsRef = useRef<InputBarsHandle>(null);
  const canvasTraceRef = useRef<CanvasTraceHandle>(null);
  const valuesRef = useRef<number[]>([]);

  useImperativeHandle(ref, () => ({
    update: (t, b, c) => {
      barsRef.current?.update(t, b, c);

      const values = valuesRef.current;
      values.length = 0;
      if (settings.showThrottle) values.push(t);
      if (settings.showBrake) values.push(b);
      if (settings.showClutch) values.push(c);

      canvasTraceRef.current?.pushSample(values);
    },
  }));

  const channels: CanvasTraceChannel[] = [];
  if (settings.showThrottle)
    channels.push({ value: initialThrottle, color: settings.throttleColor });
  if (settings.showBrake)
    channels.push({ value: initialBrake, color: settings.brakeColor });
  if (settings.showClutch)
    channels.push({ value: initialClutch, color: settings.clutchColor });

  const showBars = settings.barMode !== 'hidden';
  const isVertical = settings.barMode === 'vertical';

  return (
    <WidgetPanel
      minWidth={400}
      direction={isVertical ? 'row' : 'column'}
      gap={8}
    >
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

InputTraceWidget.displayName = 'InputTraceWidget';
