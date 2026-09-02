import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState } from '@utils/car-signals';
import { formatSpeed, speedUnit } from '@utils/telemetry-format';
import {
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

import { zoneDigitColor } from '../invisible-dash-utils';
import { ShiftBar } from '../ShiftBar/ShiftBar';

import styles from './EngineCluster.module.scss';

const RPM_PERCENT_BASE = 100;

export const EngineCluster = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  if (!settings.showSpeed && !settings.showRpm && !settings.showShiftBar) {
    return null;
  }

  const rpm = Math.round(carDynamics?.rpm ?? 0);
  const gear = carDynamics?.gear ?? 0;
  const { pct, zone } = computeRpmZoneState(rpm, sessionInfo, carStatus, gear);

  const rpmText =
    settings.rpmFormat === 'percent'
      ? `${Math.round(pct * RPM_PERCENT_BASE)}%`
      : String(rpm);

  const rpmColor = settings.colorizeRpmByZone
    ? zoneDigitColor(zone, settings)
    : null;

  return (
    <div className={styles.root}>
      {settings.showShiftBar && <ShiftBar pct={pct} zone={zone} />}

      {settings.showRpm && (
        <div className={styles.row}>
          <span
            className={styles.rpm}
            style={rpmColor ? { color: rpmColor } : undefined}
          >
            {rpmText}
          </span>

          <span className={styles.caption}>RPM</span>
        </div>
      )}

      {settings.showSpeed && (
        <div className={styles.row}>
          <span className={styles.speed}>
            {formatSpeed(carDynamics?.speed ?? 0, units.unitSystem)}
          </span>

          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        </div>
      )}
    </div>
  );
});
