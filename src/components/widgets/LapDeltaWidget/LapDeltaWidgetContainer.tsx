import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import { formatDelta, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget } from './LapDeltaWidget';

export const LapDeltaWidgetContainer = observer(() => {
  const { layout } = widgetSettingsStore.getLapDeltaSettings();

  const delta = computedStore.lapDelta?.totalDelta ?? 0;
  const sectorDeltas = computedStore.lapDelta?.sectorDeltas ?? [];
  const sectorTimes = computedStore.lapDelta?.sectorTimes ?? [];

  const widgetRef = useAutoSizeWidget('lap-delta');

  return (
    <LapDeltaWidget
      ref={widgetRef}
      deltaFormatted={formatDelta(delta)}
      deltaState={getDeltaState(delta)}
      sectorDeltas={sectorDeltas}
      sectorTimes={sectorTimes}
      layout={layout}
    />
  );
});
