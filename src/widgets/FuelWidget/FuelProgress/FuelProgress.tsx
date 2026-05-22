import React from 'react';
import { observer } from 'mobx-react-lite';

import styles from './FuelProgress.module.scss';
import { useTelemetryStore } from '@store/root-store-context';

export const FuelProgress = observer(() => {
  const telemetry = useTelemetryStore();

  const fuelLevel = telemetry.carStatus?.fuel_level ?? null;
  const fuelMax = telemetry.driverInfo?.DriverCarFuelMaxLtr ?? null;

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
