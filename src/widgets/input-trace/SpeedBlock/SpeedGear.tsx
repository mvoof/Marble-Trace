import { observer } from 'mobx-react-lite';

import { useUnitsStore } from '@entities/app-settings/units-context';
import { useTargetSpeedColor } from '@entities/corner-speeds/useTargetSpeedColor';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { LiveSpeed } from '@entities/player/readouts/LiveSpeed';
import { ShiftDigit } from '@entities/player/readouts/ShiftDigit';
import { rpmDigitColorsOf } from '@shared/lib/car-signals';
import { speedUnit } from '@shared/lib/telemetry-format';

import type { InputTraceSettings } from '../settings-schema';
import styles from './SpeedGear.module.scss';

/**
 * The car's speed and gear, a block of their own whether the wheel is shown
 * or not. With the target colour on, the speed takes the on-target or
 * over-target colour against the lit corner target. The gear can take the rev
 * zone's colour and flash at the shift point.
 */
export const SpeedGear = observer(() => {
  const units = useUnitsStore();

  const settings = useWidgetSettings<InputTraceSettings>('input-trace');
  const speedColorOf = useTargetSpeedColor(settings);

  if (!settings.showSpeedGear) {
    return null;
  }

  return (
    <div className={styles.speedGear}>
      <div className={styles.speed}>
        <LiveSpeed
          unitSystem={units.unitSystem}
          colorOf={speedColorOf}
          className={styles.speedValue}
        />

        <span className={styles.speedUnit}>{speedUnit(units.unitSystem)}</span>
      </div>

      <ShiftDigit
        format="gear"
        zoneColors={
          settings.colorizeGearByZone ? rpmDigitColorsOf(settings) : null
        }
        blink={settings.blinkAtShift}
        className={styles.gear}
      />
    </div>
  );
});
