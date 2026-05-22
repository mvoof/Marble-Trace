import { observer } from 'mobx-react-lite';

import { PcDateItem } from './PcDateItem/PcDateItem';
import { SimDateItem } from './SimDateItem/SimDateItem';
import styles from './TimerDateRow.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const TimerDateRow = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showPcDate, showSimDate } = widgetSettings.getTimerSettings();

  if (!showPcDate && !showSimDate) {
    return null;
  }

  return (
    <div className={styles.clockRow}>
      <PcDateItem />

      <SimDateItem />
    </div>
  );
});
