import { useEffect } from 'react';
import { telemetryStore } from '../store/telemetry.store';

export function useTelemetry() {
  useEffect(() => {
    telemetryStore.startStream();

    return () => {
      telemetryStore.stopStream();
    };
  }, []);
}
