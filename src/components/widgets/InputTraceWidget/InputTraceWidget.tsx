import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/telemetry.store';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { ProgressBar } from '../primitives/ProgressBar';
import { CanvasTrace } from '../primitives/CanvasTrace';
import type { CanvasTraceChannel } from '../primitives/CanvasTrace';

export const InputTraceWidget = observer(() => {
  const { frame } = telemetryStore;

  const throttle = frame?.throttle ?? 0;
  const brake = frame?.brake ?? 0;
  const clutch = frame?.clutch != null ? 1 - frame.clutch : null;

  const channels: CanvasTraceChannel[] = [
    { value: throttle, color: '#00ff00' },
    { value: brake, color: '#ff3333' },
  ];

  if (clutch !== null) {
    channels.push({ value: clutch, color: '#3399ff' });
  }

  return (
    <WidgetPanel minWidth={220}>
      <ProgressBar
        label="THR"
        value={throttle}
        color="#00ff00"
        showValue
        height="md"
      />

      <ProgressBar
        label="BRK"
        value={brake}
        color="#ff3333"
        showValue
        height="md"
      />

      {clutch !== null && (
        <ProgressBar
          label="CLT"
          value={clutch}
          color="#3399ff"
          showValue
          height="md"
        />
      )}

      <CanvasTrace channels={channels} height={80} />
    </WidgetPanel>
  );
});
