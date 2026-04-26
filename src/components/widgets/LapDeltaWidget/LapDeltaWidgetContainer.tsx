import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { formatDelta, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget } from './LapDeltaWidget';

export const LapDeltaWidgetContainer = observer(() => {
  const { layout } = widgetSettingsStore.getLapDeltaSettings();

  const delta = computedStore.lapDelta?.totalDelta ?? 0;
  const sectorDeltas = computedStore.lapDelta?.sectorDeltas ?? [];
  const sectorTimes = computedStore.lapDelta?.sectorTimes ?? [];

  const widgetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = widgetRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) widgetSettingsStore.updateAutoSize('lap-delta', w, h);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
