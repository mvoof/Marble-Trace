import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import type { RpmZone } from '@utils/car-signals';
import { useWidgetSettingsStore } from '@store/root-store-context';

import { shiftBarColor } from '../invisible-dash-utils';

import styles from './ShiftBar.module.scss';

interface ShiftBarProps {
  pct: number;
  zone: RpmZone;
}

const FULL_PERCENT = 100;

export const ShiftBar = observer(({ pct, zone }: ShiftBarProps) => {
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<InvisibleDashWidgetSettings>('invisible-dash');

  return (
    <span className={styles.track}>
      <i
        className={styles.fill}
        style={{
          right: `${FULL_PERCENT - pct * FULL_PERCENT}%`,
          background: shiftBarColor(zone, settings),
        }}
      />
    </span>
  );
});
