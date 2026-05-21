import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { useWallClock } from '@hooks/widget/useWallClock';

import styles from './WallClockItem.module.scss';

export const WallClockItem = observer(() => {
  const { showWallClock } = widgetSettingsStore.getTimerSettings();
  const wallClock = useWallClock();

  if (!showWallClock) {
    return null;
  }

  return (
    <span className={styles.clockItem}>
      <span className={styles.clockLabel}>PC</span>
      {wallClock.time}
    </span>
  );
});
