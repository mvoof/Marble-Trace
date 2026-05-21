import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';

import { PcDateItem } from './PcDateItem/PcDateItem';
import { SimDateItem } from './SimDateItem/SimDateItem';
import styles from './TimerDateRow.module.scss';

export const TimerDateRow = observer(() => {
  const { showPcDate, showSimDate } = widgetSettingsStore.getTimerSettings();

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
