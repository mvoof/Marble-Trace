import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { Bar } from './Bar/Bar';

import styles from './InputBars.module.scss';

export const InputBars = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  return (
    <div className={styles.barsVertical}>
      {settings.showClutch && (
        <Bar channel="clutch" width="lg" rounded={false} />
      )}

      {settings.showBrake && <Bar channel="brake" width="lg" rounded={false} />}

      {settings.showThrottle && (
        <Bar channel="throttle" width="lg" rounded={false} />
      )}
    </div>
  );
});
