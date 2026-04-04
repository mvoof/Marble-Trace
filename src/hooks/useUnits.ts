import { useCallback } from 'react';

import { unitsStore, type UnitSystem } from '../store/units.store';
import {
  formatSpeed as _formatSpeed,
  formatTemp as _formatTemp,
  formatFuel as _formatFuel,
  formatDistance as _formatDistance,
  speedUnit as _speedUnit,
  tempUnit as _tempUnit,
  fuelUnit as _fuelUnit,
  distanceUnit as _distanceUnit,
} from '../utils/telemetry-format';

export function useUnits() {
  const system: UnitSystem = unitsStore.system;

  const formatSpeed = useCallback(
    (mps: number) => _formatSpeed(mps, system),
    [system]
  );

  const formatTemp = useCallback(
    (celsius: number | null) => _formatTemp(celsius, system),
    [system]
  );

  const formatFuel = useCallback(
    (liters: number) => _formatFuel(liters, system),
    [system]
  );

  const formatDistance = useCallback(
    (meters: number) => _formatDistance(meters, system),
    [system]
  );

  const su = _speedUnit(system);
  const tu = _tempUnit(system);
  const fu = _fuelUnit(system);
  const du = _distanceUnit(system);

  return {
    system,
    formatSpeed,
    formatTemp,
    formatFuel,
    formatDistance,
    speedUnit: su,
    tempUnit: tu,
    fuelUnit: fu,
    distanceUnit: du,
  };
}
