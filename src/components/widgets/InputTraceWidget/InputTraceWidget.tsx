import { WidgetPanel } from '../primitives/WidgetPanel';
import { CanvasTrace } from '../primitives/CanvasTrace';
import type { CanvasTraceChannel } from '../primitives/CanvasTrace';
import type { InputTraceSettings } from '../../../types/widget-settings';
import { InputBars } from './InputBars/InputBars';

import styles from './InputTraceWidget.module.scss';

interface InputTraceWidgetProps {
  throttle: number;
  brake: number;
  clutch: number;
  settings: InputTraceSettings;
}

export const InputTraceWidget = ({
  throttle,
  brake,
  clutch,
  settings,
}: InputTraceWidgetProps) => {
  const channels: CanvasTraceChannel[] = [];

  if (settings.showThrottle)
    channels.push({ value: throttle, color: settings.throttleColor });
  if (settings.showBrake)
    channels.push({ value: brake, color: settings.brakeColor });
  if (settings.showClutch)
    channels.push({ value: clutch, color: settings.clutchColor });

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
            <InputBars
              throttle={throttle}
              brake={brake}
              clutch={clutch}
              settings={settings}
              isVertical
            />
          )}
        </>
      ) : (
        <>
          {showBars && (
            <InputBars
              throttle={throttle}
              brake={brake}
              clutch={clutch}
              settings={settings}
              isVertical={false}
            />
          )}

          <div className={styles.chartArea}>
            <CanvasTrace channels={channels} lineWidth={3.5} />
          </div>
        </>
      )}
    </WidgetPanel>
  );
};
