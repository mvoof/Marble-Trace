import { useEffect } from 'react';

import { telemetryConnectionStore } from '../store/iracing';

export const useTelemetry = () => {
  useEffect(() => {
    telemetryConnectionStore.startStream();

    return () => {
      telemetryConnectionStore.stopStream();
    };
  }, []);
};
