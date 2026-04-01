import { useEffect } from 'react';

import { telemetryConnection } from '../store/iracing';

export const useWidgetTelemetry = () => {
  useEffect(() => {
    telemetryConnection.startWidgetListener();

    return () => {
      telemetryConnection.stopWidgetListener();
    };
  }, []);
};
