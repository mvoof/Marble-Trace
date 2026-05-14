import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { formatGear } from '../../../../utils/telemetry-format';
import type { SpeedWidgetDisplayMode } from '../../../../types/widget-settings';
import styles from './SpeedDisplay.module.scss';

interface SpeedDisplayProps {
  variant: 'primary' | 'secondary';
  displayMode: SpeedWidgetDisplayMode;
  speedUnit: string;
  formatSpeed: (v: number) => string;
}

export const SpeedDisplay = observer(
  ({ variant, displayMode, speedUnit, formatSpeed }: SpeedDisplayProps) => {
    const frame = telemetryStore.carDynamics;

    const speed = frame?.speed ?? 0;
    const gear = frame?.gear ?? 0;

    const isGearFocused = displayMode === 'gear';

    if (variant === 'primary') {
      const value = isGearFocused ? formatGear(gear) : formatSpeed(speed);
      const label = isGearFocused ? 'GEAR' : speedUnit;

      return (
        <div className={styles.primaryGroup}>
          <span className={styles.primaryValue}>{value}</span>
          <span className={styles.primaryLabel}>{label}</span>
        </div>
      );
    }

    const value = isGearFocused ? formatSpeed(speed) : formatGear(gear);
    const label = isGearFocused ? speedUnit : 'GEAR';

    return (
      <>
        <span className={styles.secondaryValue}>{value}</span>
        <span className={styles.secondaryLabel}>{label}</span>
      </>
    );
  }
);
