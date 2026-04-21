import { useEffect } from 'react';

import { telemetryConnectionStore } from '../store/iracing';

export const useTelemetry = () => {
  useEffect(() => {
    void telemetryConnectionStore.startStream();

    return () => {
      void telemetryConnectionStore.stopStream();
    };
  }, []);
};
