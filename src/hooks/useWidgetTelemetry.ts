import { useEffect } from 'react';

import { telemetryConnectionStore } from '../store/iracing';

export const useWidgetTelemetry = () => {
  useEffect(() => {
    telemetryConnectionStore.startWidgetListener();

    return () => {
      telemetryConnectionStore.stopWidgetListener();
    };
  }, []);
};
