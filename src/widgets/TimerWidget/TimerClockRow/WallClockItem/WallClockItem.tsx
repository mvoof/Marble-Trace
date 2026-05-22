import { observer } from 'mobx-react-lite';

import { useWallClock } from '@hooks/widget/useWallClock';

import styles from './WallClockItem.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const WallClockItem = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showWallClock } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');
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
