import { observer } from 'mobx-react-lite';

import { LapTimingRow } from '@/components/shared/LapTimingRow/LapTimingRow';
import {
  formatSectorDelta,
  formatSectorTime,
  getDeltaColor,
  getSectorDeltaState,
} from '@utils/widget/lap-delta-utils';
import { getSectorColor } from '@utils/widget/sector-utils';

import type { LapDeltaWidgetSettings } from '@/types/widget-settings';
import styles from './SectorList.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SectorList = observer(() => {
  const { lapDelta } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference, layout, showSectorTimes } =
    widgetSettings.getSettings<LapDeltaWidgetSettings>('lap-delta');

  const isHorizontal = layout === 'horizontal';

  if (!showSectorTimes) {
    return null;
  }

  const isSession = reference === 'session_best';

  const sectorDeltas = isSession
    ? (lapDelta?.sessionBestSectors ?? [])
    : (lapDelta?.personalBestSectors ?? []);

  const sectorTimes = lapDelta?.sectorTimes ?? [];
  const sectorCount = Math.max(sectorDeltas.length, sectorTimes.length);

  const containerClass = isHorizontal
    ? styles.sectorListHorizontal
    : styles.sectorListVertical;

  return (
    <div className={containerClass}>
      {Array.from({ length: sectorCount }, (_, index) => {
        const time = sectorTimes[index] ?? null;
        const delta = sectorDeltas[index] ?? null;
        const accent = getSectorColor(index);

        return (
          <LapTimingRow
            key={`sector-${index}`}
            label={`S${index + 1}`}
            time={formatSectorTime(time)}
            delta={formatSectorDelta(delta)}
            accentColor={accent}
            deltaColor={getDeltaColor(getSectorDeltaState(delta))}
            fill={isHorizontal}
          />
        );
      })}
    </div>
  );
});
