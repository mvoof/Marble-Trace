import { observer } from 'mobx-react-lite';

import { carInputsStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { ProgressBar } from '../primitives/ProgressBar';
import { CanvasTrace } from '../primitives/CanvasTrace';
import type { CanvasTraceChannel } from '../primitives/CanvasTrace';
import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => {
  const frame = carInputsStore.frame;
  const settings = widgetSettingsStore.getInputTraceSettings();

  const throttle = frame?.throttle ?? 0;
  const brake = frame?.brake ?? 0;
  const clutch = frame?.clutch != null ? 1 - frame.clutch : 0;

  const channels: CanvasTraceChannel[] = [];

  if (settings.showThrottle) {
    channels.push({ value: throttle, color: settings.throttleColor });
  }

  if (settings.showBrake) {
    channels.push({ value: brake, color: settings.brakeColor });
  }

  if (settings.showClutch) {
    channels.push({ value: clutch, color: settings.clutchColor });
  }

  const showBars = settings.barMode !== 'hidden';
  const isVertical = settings.barMode === 'vertical';

  return (
    <WidgetPanel
      minWidth={400}
      direction={isVertical ? 'row' : 'column'}
      gap={8}
    >
      {isVertical ? (
        <>
          <div className={styles.chartArea}>
            <CanvasTrace channels={channels} lineWidth={3.5} />
          </div>

          {showBars && (
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
          )}
        </>
      ) : (
        <>
          {showBars && (
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
          )}

          <div className={styles.chartArea}>
            <CanvasTrace channels={channels} lineWidth={3.5} />
          </div>
        </>
      )}
    </WidgetPanel>
  );
});
