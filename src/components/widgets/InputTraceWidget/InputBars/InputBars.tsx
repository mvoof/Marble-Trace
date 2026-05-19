import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { Bar } from './Bar/Bar';

import styles from './InputBars.module.scss';

interface InputBarsProps {
  isVertical: boolean;
}

export const InputBars = observer(({ isVertical }: InputBarsProps) => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  if (isVertical) {
    return (
      <div className={styles.barsVertical}>
        {settings.showClutch && (
          <Bar channel="clutch" width="lg" vertical rounded={false} />
        )}

        {settings.showBrake && (
          <Bar channel="brake" width="lg" vertical rounded={false} />
        )}

        {settings.showThrottle && (
          <Bar channel="throttle" width="lg" vertical rounded={false} />
        )}
      </div>
    );
  }

  return (
    <div className={styles.barsHorizontal}>
      {settings.showThrottle && (
        <Bar channel="throttle" width="lg" rounded={false} />
      )}

      {settings.showBrake && <Bar channel="brake" width="lg" rounded={false} />}

      {settings.showClutch && (
        <Bar channel="clutch" width="lg" rounded={false} />
      )}
    </div>
  );
});
