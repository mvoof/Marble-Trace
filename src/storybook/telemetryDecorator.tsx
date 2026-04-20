import { useEffect } from 'react';
import type { Decorator } from '@storybook/react';
import { telemetryStore } from '../store/iracing';
import type { TelemetrySnapshot } from './snapshot.types';

/**
 * Storybook decorator that populates telemetryStore with a captured snapshot.
 * Usage: add `decorators: [withTelemetry(snapshot)]` to a story.
 */
export const withTelemetry = (snapshot: TelemetrySnapshot): Decorator => {
  const TelemetryDecorator: Decorator = (Story) => {
    useEffect(() => {
      if (snapshot.carDynamics)
        telemetryStore.updateCarDynamics(snapshot.carDynamics);
      if (snapshot.carIdx) telemetryStore.updateCarIdx(snapshot.carIdx);
      if (snapshot.carInputs)
        telemetryStore.updateCarInputs(snapshot.carInputs);
      if (snapshot.carStatus)
        telemetryStore.updateCarStatus(snapshot.carStatus);
      if (snapshot.environment)
        telemetryStore.updateEnvironment(snapshot.environment);
      if (snapshot.lapTiming)
        telemetryStore.updateLapTiming(snapshot.lapTiming);
      if (snapshot.session) telemetryStore.updateSession(snapshot.session);
      if (snapshot.sessionInfo)
        telemetryStore.updateSessionInfo(snapshot.sessionInfo);

      return () => telemetryStore.reset();
    }, []);

    return <Story />;
  };

  return TelemetryDecorator;
};
