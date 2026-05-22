import { observer } from 'mobx-react-lite';

import { SimTimeItem } from './SimTimeItem/SimTimeItem';
import { WallClockItem } from './WallClockItem/WallClockItem';
import styles from './TimerClockRow.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const TimerClockRow = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showWallClock, showSimTime } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');

  if (!showWallClock && !showSimTime) {
    return null;
  }

  return (
    <div className={styles.clockRow}>
      <WallClockItem />

      <SimTimeItem />
    </div>
  );
});
