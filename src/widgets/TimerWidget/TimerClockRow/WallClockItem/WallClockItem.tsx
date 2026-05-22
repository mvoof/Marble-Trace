import { observer } from 'mobx-react-lite';

import { useWallClock } from '@hooks/widget/useWallClock';

import styles from './WallClockItem.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const WallClockItem = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showWallClock } = widgetSettings.getTimerSettings();
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
