import { useEffect, useRef } from 'react';
import { autorun } from 'mobx';
import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import { formatDelta, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget, type DeltaDisplayHandle } from './LapDeltaWidget';

export const LapDeltaWidgetContainer = observer(() => {
  const { layout, showSectorTimes, reference } =
    widgetSettingsStore.getLapDeltaSettings();

  const isSession = reference === 'session_best';
  const delta = isSession
    ? (computedStore.lapDelta?.sessionBestTotal ?? 0)
    : (computedStore.lapDelta?.personalBestTotal ?? 0);
  const sectorDeltas = isSession
    ? (computedStore.lapDelta?.sessionBestSectors ?? [])
    : (computedStore.lapDelta?.personalBestSectors ?? []);
  const sectorTimes = computedStore.lapDelta?.sectorTimes ?? [];

  const widgetRef = useAutoSizeWidget('lap-delta');
  const deltaDisplayRef = useRef<DeltaDisplayHandle | null>(null);

  useEffect(() => {
    return autorun(() => {
      const isSessionLive =
        widgetSettingsStore.getLapDeltaSettings().reference === 'session_best';
      const rawDelta = isSessionLive
        ? (computedStore.lapDelta?.sessionBestTotal ?? 0)
        : (computedStore.lapDelta?.personalBestTotal ?? 0);
      deltaDisplayRef.current?.update(
        formatDelta(rawDelta),
        getDeltaState(rawDelta)
      );
    });
  }, []);

  return (
    <LapDeltaWidget
      ref={widgetRef}
      initialDeltaFormatted={formatDelta(delta)}
      initialDeltaState={getDeltaState(delta)}
      sectorDeltas={sectorDeltas}
      sectorTimes={sectorTimes}
      layout={layout}
      showSectorTimes={showSectorTimes}
      deltaDisplayRef={deltaDisplayRef}
    />
  );
});
