import { useEffect, useRef } from 'react';
import { autorun, untracked } from 'mobx';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { InputTraceWidget, type InputTraceHandle } from './InputTraceWidget';

export const InputTraceWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();
  const inputTraceRef = useRef<InputTraceHandle>(null);

  useEffect(() => {
    return autorun(() => {
      const frame = telemetryStore.carInputs;
      if (!frame) return;

      const throttle = frame.throttle ?? 0;
      const brake = frame.brake ?? 0;
      const clutch = frame.clutch != null ? 1 - frame.clutch : 0;

      inputTraceRef.current?.update(throttle, brake, clutch);
    });
  }, [settings.showThrottle, settings.showBrake, settings.showClutch]);

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
