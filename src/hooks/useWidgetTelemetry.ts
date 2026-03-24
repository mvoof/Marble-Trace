import { useEffect } from 'react';
import { telemetryStore } from '../store/telemetry.store';

export function useWidgetTelemetry() {
  useEffect(() => {
    telemetryStore.startWidgetListener();

    return () => {
      telemetryStore.stopWidgetListener();
    };
  }, []);
}
