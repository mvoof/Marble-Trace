import React from 'react';
import { observer } from 'mobx-react-lite';

import { formatFuel } from '@shared/lib/telemetry-format';

import styles from './FuelProgress.module.scss';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';

export const FuelProgress = observer(() => {
  const { carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const { unitSystem } = useUnitsStore();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const fuelMax = sessionInfo?.fuelCapacityLtr ?? null;

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
          {fuelMax !== null ? `${formatFuel(fuelMax, unitSystem)} MAX` : ''}
        </span>
      </div>
    </div>
  );
});
