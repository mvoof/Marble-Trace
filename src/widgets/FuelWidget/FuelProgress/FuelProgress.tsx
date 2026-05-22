import React from 'react';
import { observer } from 'mobx-react-lite';

import { formatFuel, fuelUnit } from '@utils/formatters/telemetry-format';

import styles from './FuelProgress.module.scss';
import { useTelemetryStore, useUnitsStore } from '@store/root-store-context';

export const FuelProgress = observer(() => {
  const { carStatus, driverInfo } = useTelemetryStore();
  const { unitSystem } = useUnitsStore();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const fuelMax = driverInfo?.DriverCarFuelMaxLtr ?? null;

  const pct =
    fuelLevel !== null && fuelMax !== null && fuelMax > 0
      ? Math.min(fuelLevel / fuelMax, 1)
      : null;

  return (
    <div className={styles.progressSection}>
      <div className={styles.progressWrap}>
        {pct !== null && (
          <div
            className={styles.progressBar}
            style={{ '--progress': pct } as React.CSSProperties}
          />
        )}

        <span className={styles.progressLabelMax}>
          {fuelMax !== null
            ? `${formatFuel(fuelMax, unitSystem)} ${fuelUnit(unitSystem)} MAX`
            : ''}
        </span>
      </div>
    </div>
  );
});
