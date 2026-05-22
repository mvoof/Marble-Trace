import { observer } from 'mobx-react-lite';

import type { ChassisWidgetSettings } from '@/types/widget-settings';
import styles from './CenterLabels.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const CenterLabels = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showSuspensionAndBrakes } =
    widgetSettings.getSettings<ChassisWidgetSettings>('chassis');

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
