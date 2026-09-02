import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { ArrowBigUp, ArrowBigDown } from 'lucide-react';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { useStandingsWidgetStore } from '@store/root-store-context';

import styles from './DriverRow.module.scss';

const ARROW_SIZE_PX = 14;

interface PositionCellProps {
  carIdx: number;
}

export const PositionCell = observer(({ carIdx }: PositionCellProps) => {
  const standingsWidget = useStandingsWidgetStore();

  const driver = standingsWidget.driverMap.get(carIdx);
  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  if (!driver) {
    return null;
  }

  const rank = standingsWidget.renderedRanks.get(carIdx);

  const position =
    settings.viewMode === 'all'
      ? (rank?.overall ?? driver.livePosition)
      : (rank?.inClass ?? driver.liveClassPosition);

  const change = settings.showLivePosChange
    ? standingsWidget.positionChanges.get(carIdx)
    : undefined;

  return (
    <div className={`${styles.cell} ${styles.posCell}`}>
      {change === 'up' && (
        <ArrowBigUp
          className={styles.livePosArrowUp}
          size={ARROW_SIZE_PX}
          fill="currentColor"
        />
      )}

      {change === 'down' && (
        <ArrowBigDown
          className={styles.livePosArrowDown}
          size={ARROW_SIZE_PX}
          fill="currentColor"
        />
      )}

      {change === undefined && (
        <span
          className={`${styles.posNumber} ${driver.isPlayer ? styles.posNumberPlayer : ''}`}
          style={
            driver.isPlayer ? { color: settings.playerAccentColor } : undefined
          }
        >
          {position}
        </span>
      )}
    </div>
  );
});
