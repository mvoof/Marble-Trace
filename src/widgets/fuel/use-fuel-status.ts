import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { type FuelLapsStatus, resolveLapsStatus } from './fuel-utils';
import type { FuelWidgetSettings } from './settings-schema';

/**
 * How urgent the tank is — read by every block that colors by it, so the
 * header, the bar, LAPS LEFT and the border turn together.
 */
export const useFuelLapsStatus = (): FuelLapsStatus | null => {
  const { fuel } = useBackendComputedStore();
  const settings = useWidgetSettings<FuelWidgetSettings>('fuel');

  return resolveLapsStatus(
    fuel?.lapsRemaining ?? null,
    settings.pitWarningLaps
  );
};
