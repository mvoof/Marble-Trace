import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';

import { SimTimeItem } from './SimTimeItem/SimTimeItem';
import { WallClockItem } from './WallClockItem/WallClockItem';
import styles from './TimerClockRow.module.scss';

export const TimerClockRow = observer(() => {
  const { showWallClock, showSimTime } = widgetSettingsStore.getTimerSettings();

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
