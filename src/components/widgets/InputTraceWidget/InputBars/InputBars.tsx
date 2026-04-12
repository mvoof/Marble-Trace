import { ProgressBar } from '../../primitives/ProgressBar';
import type { widgetSettingsStore } from '../../../../store/widget-settings.store';

import styles from './InputBars.module.scss';

interface InputBarsProps {
  throttle: number;
  brake: number;
  clutch: number;
  settings: ReturnType<typeof widgetSettingsStore.getInputTraceSettings>;
  isVertical: boolean;
}

export const InputBars = ({
  throttle,
  brake,
  clutch,
  settings,
  isVertical,
}: InputBarsProps) => {
  if (isVertical) {
    return (
      <div className={styles.barsVertical}>
        {settings.showClutch && (
          <ProgressBar
            value={clutch}
            color={settings.clutchColor}
            height="lg"
            vertical
            rounded={false}
          />
        )}

        {settings.showBrake && (
          <ProgressBar
            value={brake}
            color={settings.brakeColor}
            height="lg"
            vertical
            rounded={false}
          />
        )}

        {settings.showThrottle && (
          <ProgressBar
            value={throttle}
            color={settings.throttleColor}
            height="lg"
            vertical
            rounded={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.barsHorizontal}>
      {settings.showThrottle && (
        <ProgressBar
          value={throttle}
          color={settings.throttleColor}
          height="lg"
          rounded={false}
        />
      )}

      {settings.showBrake && (
        <ProgressBar
          value={brake}
          color={settings.brakeColor}
          height="lg"
          rounded={false}
        />
      )}

      {settings.showClutch && (
        <ProgressBar
          value={clutch}
          color={settings.clutchColor}
          height="lg"
          rounded={false}
        />
      )}
    </div>
  );
};
