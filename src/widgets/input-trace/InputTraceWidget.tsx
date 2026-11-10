import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { InputBars } from './InputBars/InputBars';
import { CanvasTrace } from './CanvasTrace/CanvasTrace';
import { CornerSpeeds } from './SpeedBlock/CornerSpeeds';
import { SpeedGear } from './SpeedBlock/SpeedGear';
import { SteeringWheel } from './SteeringWheel/SteeringWheel';

import styles from './InputTraceWidget.module.scss';
import type { InputTraceSettings } from './settings-schema';

export const InputTraceWidget = observer(() => {
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  const barsEffectivelyHidden =
    !settings.showBars ||
    (!settings.showThrottle && !settings.showBrake && !settings.showClutch);

  const showTrace = settings.showTrace;

  const allHidden =
    !showTrace &&
    !settings.showSteering &&
    !settings.showSpeedGear &&
    !settings.showCornerSpeeds &&
    barsEffectivelyHidden;

  if (allHidden) {
    return (
      <WidgetPanel direction="row" gap={8} edgeInset>
        <div className={styles.emptyState}>
          Input widget. All elements hidden in settings
        </div>
      </WidgetPanel>
    );
  }

  // Without the graph there is no left of it: the block keeps its place.
  const speedBlockOnLeft = showTrace && settings.speedBlockSide === 'left';

  const speedBlock = (settings.showSpeedGear || settings.showCornerSpeeds) && (
    <div className={styles.speedBlock}>
      <SpeedGear />

      <CornerSpeeds />
    </div>
  );

  // Beside the bars the graph is as tall as they are, stop to stop.
  const chartClassName = [
    styles.chartArea,
    !barsEffectivelyHidden &&
      settings.showInputValues &&
      styles.chartBesideValues,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <WidgetPanel direction="row" gap={8} edgeInset className={styles.panel}>
      {speedBlockOnLeft && speedBlock}

      {showTrace && (
        <div className={chartClassName}>
          <CanvasTrace />
        </div>
      )}

      <InputBars />

      {!speedBlockOnLeft && speedBlock}

      <SteeringWheel />
    </WidgetPanel>
  );
});
