import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { TimingRow } from '../../../shared/TimingRow/TimingRow';
import {
  formatSectorDelta,
  formatSectorTime,
  getDeltaColor,
  getSectorDeltaState,
  SECTOR_ACCENT_COLORS,
} from '../lap-delta-utils';

import styles from './SectorList.module.scss';

interface SectorListProps {
  isHorizontal: boolean;
}

export const SectorList = observer(({ isHorizontal }: SectorListProps) => {
  const { reference } = widgetSettingsStore.getLapDeltaSettings();
  const isSession = reference === 'session_best';

  const sectorDeltas = isSession
    ? (computedStore.lapDelta?.sessionBestSectors ?? [])
    : (computedStore.lapDelta?.personalBestSectors ?? []);

  const sectorTimes = computedStore.lapDelta?.sectorTimes ?? [];
  const sectorCount = Math.max(sectorDeltas.length, sectorTimes.length);

  const containerClass = isHorizontal
    ? styles.sectorListHorizontal
    : styles.sectorListVertical;

  return (
    <div className={containerClass}>
      {Array.from({ length: sectorCount }, (_, index) => {
        const time = sectorTimes[index] ?? null;
        const delta = sectorDeltas[index] ?? null;
        const accent =
          SECTOR_ACCENT_COLORS[index % SECTOR_ACCENT_COLORS.length];

        return (
          <TimingRow
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
