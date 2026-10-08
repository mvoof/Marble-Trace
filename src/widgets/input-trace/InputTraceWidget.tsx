import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { InputBars } from './InputBars/InputBars';
import { CanvasTrace } from './CanvasTrace/CanvasTrace';
import { SteeringWheel } from './SteeringWheel/SteeringWheel';

import styles from './InputTraceWidget.module.scss';
import type { InputTraceSettings } from './settings-schema';

export const InputTraceWidget = observer(() => {
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  const barsEffectivelyHidden =
    !settings.showThrottle && !settings.showBrake && !settings.showClutch;

  const showTrace = settings.showTrace;

  const allHidden =
    !showTrace && !settings.showSteering && barsEffectivelyHidden;

  if (allHidden) {
    return (
      <WidgetPanel direction="row" gap={8} edgeInset>
        <div className={styles.emptyState}>
          Input widget. All elements hidden in settings
        </div>
      </WidgetPanel>
    );
  }

  return (
    <WidgetPanel direction="row" gap={8} edgeInset>
      {showTrace && (
        <div className={styles.chartArea}>
          <CanvasTrace />
        </div>
      )}

      <InputBars />

      <SteeringWheel />
    </WidgetPanel>
  );
});
