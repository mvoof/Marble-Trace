import React from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';

import styles from './FuelProgress.module.scss';

export const FuelProgress = observer(() => {
  const fuelLevel = telemetryStore.carStatus?.fuel_level ?? null;
  const fuelMax = telemetryStore.driverInfo?.DriverCarFuelMaxLtr ?? null;

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
          {fuelMax !== null ? `${fuelMax.toFixed(0)}L MAX` : ''}
        </span>
      </div>
    </div>
  );
});
