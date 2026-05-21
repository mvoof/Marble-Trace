import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { useWallClock } from '@hooks/widget/useWallClock';

import styles from './PcDateItem.module.scss';

export const PcDateItem = observer(() => {
  const { showPcDate } = widgetSettingsStore.getTimerSettings();
  const wallClock = useWallClock();

  if (!showPcDate) {
    return null;
  }

  return (
    <span className={styles.clockItem}>
      <span className={styles.clockLabel}>DATE</span>
      {wallClock.date}
    </span>
  );
});
