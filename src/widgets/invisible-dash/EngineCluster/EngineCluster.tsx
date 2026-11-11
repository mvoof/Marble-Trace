import { observer } from 'mobx-react-lite';

import { useUnitsStore } from '@entities/app-settings/units-context';
import { useTargetSpeedColor } from '@entities/corner-speeds/useTargetSpeedColor';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { LiveSpeed } from '@entities/player/readouts/LiveSpeed';
import { ShiftDigit } from '@entities/player/readouts/ShiftDigit';
import { rpmDigitColorsOf } from '@shared/lib/car-signals';
import { speedUnit } from '@shared/lib/telemetry-format';

import { ShiftBar } from '../ShiftBar/ShiftBar';
import type { InvisibleDashWidgetSettings } from '../settings-schema';
import styles from './EngineCluster.module.scss';

/**
 * The revs and the speed. With the blink on, the RPM number flashes at the
 * shift point; with the target colour on, the speed takes the on-target or
 * over-target colour against the lit corner target.
 */
export const EngineCluster = observer(() => {
  const units = useUnitsStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  const speedColorOf = useTargetSpeedColor(settings);

  if (!settings.showSpeed && !settings.showRpm && !settings.showShiftBar) {
    return null;
  }

  return (
    <div className={styles.root}>
      {settings.showShiftBar && <ShiftBar />}

      {settings.showRpm && (
        <div className={styles.row}>
          <ShiftDigit
            format={settings.rpmFormat === 'percent' ? 'rpmPercent' : 'rpm'}
            zoneColors={
              settings.colorizeRpmByZone ? rpmDigitColorsOf(settings) : null
            }
            blink={settings.blinkAtShift}
            className={styles.rpm}
          />

          <span className={styles.caption}>RPM</span>
        </div>
      )}

      {settings.showSpeed && (
        <div className={styles.row}>
          <LiveSpeed
            unitSystem={units.unitSystem}
            colorOf={speedColorOf}
            className={styles.speed}
          />

          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        </div>
      )}
    </div>
  );
});
