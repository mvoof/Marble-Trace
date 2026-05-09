import { useEffect, useRef } from 'react';
import { autorun, untracked } from 'mobx';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { InputTraceWidget, type InputTraceHandle } from './InputTraceWidget';

export const InputTraceWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();
  const inputTraceRef = useRef<InputTraceHandle>(null);

  const smoothedThrottle = useRef(0);
  const smoothedBrake = useRef(0);
  const smoothedClutch = useRef(0);

  useEffect(() => {
    return autorun(() => {
      const frame = telemetryStore.carInputs;
      if (!frame) return;

      const rawT = frame.throttle ?? 0;
      const rawB = frame.brake ?? 0;
      const rawC = frame.clutch != null ? 1 - frame.clutch : 0;

      const s = settings.smoothing;

      if (s <= 0) {
        smoothedThrottle.current = rawT;
        smoothedBrake.current = rawB;
        smoothedClutch.current = rawC;
      } else {
        // Simple Exponential Moving Average
        // NewValue = (PrevValue * S + RawValue) / (S + 1)
        smoothedThrottle.current =
          (smoothedThrottle.current * s + rawT) / (s + 1);
        smoothedBrake.current = (smoothedBrake.current * s + rawB) / (s + 1);
        smoothedClutch.current = (smoothedClutch.current * s + rawC) / (s + 1);
      }

      inputTraceRef.current?.update(
        smoothedThrottle.current,
        smoothedBrake.current,
        smoothedClutch.current
      );
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

  return (
    <InputTraceWidget
      ref={inputTraceRef}
      initialThrottle={initialThrottle}
      initialBrake={initialBrake}
      initialClutch={initialClutch}
      settings={settings}
    />
  );
});
