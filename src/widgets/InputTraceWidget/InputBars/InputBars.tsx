import { observer } from 'mobx-react-lite';
import type { InputTraceSettings } from '@/types/widget-settings';

import { Bar } from './Bar/Bar';

import styles from './InputBars.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const InputBars = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');

  if (settings.barMode === 'hidden') {
    return null;
  }

  return (
    <div className={styles.barsVertical}>
      <Bar channel="clutch" width="lg" rounded={false} />
      <Bar channel="brake" width="lg" rounded={false} />
      <Bar channel="throttle" width="lg" rounded={false} />
    </div>
  );
});
