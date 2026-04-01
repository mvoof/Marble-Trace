import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { ProgressBar } from '../primitives/ProgressBar';
import { CanvasTrace } from '../primitives/CanvasTrace';
import type { CanvasTraceChannel } from '../primitives/CanvasTrace';
import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => {
  const { frame } = telemetryStore;
  const settings = widgetSettingsStore.getInputTraceSettings();

  const throttle = frame?.throttle ?? 0;
  const brake = frame?.brake ?? 0;
  const clutch = frame?.clutch ?? 0;

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
    <WidgetPanel minWidth={220} direction={isVertical ? 'row' : 'column'}>
      {isVertical ? (
        <>
          <div className={styles.chartArea}>
            <CanvasTrace channels={channels} lineWidth={3.5} />
          </div>

          {showBars && (
            <div className={styles.barsVertical}>
              {settings.showThrottle && (
                <ProgressBar
                  label="THR"
                  value={throttle}
                  color={settings.throttleColor}
                  showValue
                  height="lg"
                  vertical
                />
              )}

              {settings.showBrake && (
                <ProgressBar
                  label="BRK"
                  value={brake}
                  color={settings.brakeColor}
                  showValue
                  height="lg"
                  vertical
                />
              )}

              {settings.showClutch && (
                <ProgressBar
                  label="CLT"
                  value={clutch}
                  color={settings.clutchColor}
                  showValue
                  height="lg"
                  vertical
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
                  label="THR"
                  value={throttle}
                  color={settings.throttleColor}
                  showValue
                  height="lg"
                />
              )}

              {settings.showBrake && (
                <ProgressBar
                  label="BRK"
                  value={brake}
                  color={settings.brakeColor}
                  showValue
                  height="lg"
                />
              )}

              {settings.showClutch && (
                <ProgressBar
                  label="CLT"
                  value={clutch}
                  color={settings.clutchColor}
                  showValue
                  height="lg"
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
