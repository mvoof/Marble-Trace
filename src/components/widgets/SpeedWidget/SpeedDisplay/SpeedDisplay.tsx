import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../../store/units.store';
import {
  formatSpeed,
  formatGear,
  speedUnit,
} from '../../../../utils/telemetry-format';
import type { SpeedWidgetDisplayMode } from '../../../../types/widget-settings';
import styles from './SpeedDisplay.module.scss';

interface SpeedDisplayProps {
  variant: 'primary' | 'secondary';
  displayMode: SpeedWidgetDisplayMode;
}

export const SpeedDisplay = observer(
  ({ variant, displayMode }: SpeedDisplayProps) => {
    const frame = telemetryStore.carDynamics;

    const speed = frame?.speed ?? 0;
    const gear = frame?.gear ?? 0;

    const isGearFocused = displayMode === 'gear';

    const sys = unitsStore.system;

    if (variant === 'primary') {
      const value = isGearFocused ? formatGear(gear) : formatSpeed(speed, sys);
      const label = isGearFocused ? 'GEAR' : speedUnit(sys);

      return (
        <div className={styles.primaryGroup}>
          <span className={styles.primaryValue}>{value}</span>
          <span className={styles.primaryLabel}>{label}</span>
        </div>
      );
    }

    const value = isGearFocused ? formatSpeed(speed, sys) : formatGear(gear);
    const label = isGearFocused ? speedUnit(sys) : 'GEAR';

    return (
      <>
        <span className={styles.secondaryValue}>{value}</span>
        <span className={styles.secondaryLabel}>{label}</span>
      </>
    );
  }
);
