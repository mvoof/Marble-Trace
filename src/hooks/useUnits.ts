import { useCallback } from 'react';

import { unitsStore, type UnitSystem } from '../store/units.store';
import {
  formatSpeed as _formatSpeed,
  formatTemp as _formatTemp,
  formatFuel as _formatFuel,
  speedUnit as _speedUnit,
  tempUnit as _tempUnit,
  fuelUnit as _fuelUnit,
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

  const su = _speedUnit(system);
  const tu = _tempUnit(system);
  const fu = _fuelUnit(system);

  return {
    system,
    formatSpeed,
    formatTemp,
    formatFuel,
    speedUnit: su,
    tempUnit: tu,
    fuelUnit: fu,
  };
}
