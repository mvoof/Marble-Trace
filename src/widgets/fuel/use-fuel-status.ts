import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { type FuelLapsStatus, resolveLapsStatus } from './fuel-utils';

/**
 * How urgent the tank is — read by every block that colors by it, so the
 * header, the bar, LAPS LEFT and the border turn together.
 */
export const useFuelLapsStatus = (): FuelLapsStatus | null => {
  const { fuel } = useBackendComputedStore();
  const { appSettings } = useAppSettingsStore();

  return resolveLapsStatus(
    fuel?.lapsRemaining ?? null,
    appSettings.fuelPitWarningLaps
  );
};
