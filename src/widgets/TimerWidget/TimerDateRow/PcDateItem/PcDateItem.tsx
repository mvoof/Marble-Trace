import { observer } from 'mobx-react-lite';

import { useWallClock } from '@hooks/widget/useWallClock';

import styles from './PcDateItem.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const PcDateItem = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showPcDate } = widgetSettings.getTimerSettings();
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
