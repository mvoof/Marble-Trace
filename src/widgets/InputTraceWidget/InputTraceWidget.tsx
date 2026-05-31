import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettingsStore } from '@store/root-store-context';
import type { InputTraceSettings } from '@/types/widget-settings';
import { InputBars } from './InputBars/InputBars';
import { CanvasTrace } from './CanvasTrace/CanvasTrace';
import { SteeringWheel } from './SteeringWheel/SteeringWheel';

import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');

  const barsEffectivelyHidden =
    !settings.showThrottle && !settings.showBrake && !settings.showClutch;

  const traceHasContent =
    settings.showThrottle ||
    settings.showBrake ||
    settings.showClutch ||
    settings.showSteering;

  const showTrace = settings.showTrace && traceHasContent;

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
