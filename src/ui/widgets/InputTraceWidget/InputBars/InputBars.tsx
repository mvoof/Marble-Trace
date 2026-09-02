import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import type { InputTraceSettings } from '@/types/widget-settings';

import { Bar } from './Bar/Bar';

import styles from './InputBars.module.scss';

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
