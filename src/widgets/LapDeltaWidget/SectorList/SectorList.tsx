import { observer } from 'mobx-react-lite';

import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import {
  formatSectorDelta,
  formatSectorTime,
  getDeltaColor,
  getSectorDeltaState,
  SECTOR_ACCENT_COLORS,
} from '@utils/widget/lap-delta-utils';

import type { LapDeltaWidgetSettings } from '@/types/widget-settings';
import styles from './SectorList.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SectorList = observer(() => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference, layout, showSectorTimes } =
    widgetSettings.getSettings<LapDeltaWidgetSettings>('lap-delta');
  const isHorizontal = layout === 'horizontal';

  if (!showSectorTimes) {
    return null;
  }

  const isSession = reference === 'session_best';

  const sectorDeltas = isSession
    ? (computed.lapDelta?.sessionBestSectors ?? [])
    : (computed.lapDelta?.personalBestSectors ?? []);

  const sectorTimes = computed.lapDelta?.sectorTimes ?? [];
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
