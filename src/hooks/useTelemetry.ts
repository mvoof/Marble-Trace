import { useEffect } from 'react';

import { telemetryConnection } from '../store/iracing';

export const useTelemetry = () => {
  useEffect(() => {
    telemetryConnection.startStream();

    return () => {
      telemetryConnection.stopStream();
    };
  }, []);
};
