import { useEffect } from 'react';
import { telemetryConnectionStore } from '../store/iracing';

/**
 * Used by the overlay window — subscribes to telemetry events
 * without starting the stream (the main window owns the stream).
 */
export const useWidgetTelemetry = () => {
  useEffect(() => {
    telemetryConnectionStore.startWidgetListener();
    return () => telemetryConnectionStore.stopWidgetListener();
  }, []);
};
