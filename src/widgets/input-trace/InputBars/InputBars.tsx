import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { Bar } from './Bar/Bar';

import styles from './InputBars.module.scss';
import type { InputTraceSettings } from '../settings-schema';

export const InputBars = observer(() => {
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  if (!settings.showThrottle && !settings.showBrake && !settings.showClutch) {
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
