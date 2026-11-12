import { observer } from 'mobx-react-lite';

import { useUnitsStore } from '@entities/app-settings/units-context';
import { useTargetSpeedColor } from '@entities/corner-speeds/useTargetSpeedColor';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { LiveSpeed } from '@entities/player/readouts/LiveSpeed';
import { speedUnit } from '@shared/lib/telemetry-format';

import type { RaceDashWidgetSettings } from '../settings-schema';
import styles from './SpeedReadout.module.scss';

/**
 * The speed. With the target colour on, it takes the on-target or over-target
 * colour against the lit corner target.
 */
export const SpeedReadout = observer(() => {
  const units = useUnitsStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const speedColorOf = useTargetSpeedColor(settings);

  return (
    <div className={styles.root}>
      <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>

      <LiveSpeed
        unitSystem={units.unitSystem}
        colorOf={speedColorOf}
        className={styles.value}
      />
    </div>
  );
});
