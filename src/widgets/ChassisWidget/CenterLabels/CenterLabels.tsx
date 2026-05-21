import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import styles from './CenterLabels.module.scss';

export const CenterLabels = observer(() => {
  const { showSuspensionAndBrakes } = widgetSettingsStore.getChassisSettings();

  if (!showSuspensionAndBrakes) {
    return null;
  }

  return (
    <div className={styles.centerLabels}>
      <span className={styles.centerLabel}>RH</span>
      <span className={styles.centerLabel}>BRK</span>
      <span className={styles.centerLabel}>SHK</span>
    </div>
  );
});
