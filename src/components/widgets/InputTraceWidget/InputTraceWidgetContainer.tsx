import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { InputTraceWidget } from './InputTraceWidget';

export const InputTraceWidgetContainer = observer(() => {
  const frame = telemetryStore.carInputs;
  const settings = widgetSettingsStore.getInputTraceSettings();

  const throttle = frame?.throttle ?? 0;
  const brake = frame?.brake ?? 0;
  const clutch = frame?.clutch != null ? 1 - frame.clutch : 0;

  return (
    <InputTraceWidget
      throttle={throttle}
      brake={brake}
      clutch={clutch}
      settings={settings}
    />
  );
});
