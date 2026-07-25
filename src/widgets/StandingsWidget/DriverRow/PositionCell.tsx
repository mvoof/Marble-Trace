import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './DriverRow.module.scss';

const ARROW_SIZE_PX = 14;

interface PositionCellProps {
  carIdx: number;
}

export const PositionCell = observer(({ carIdx }: PositionCellProps) => {
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const driver = standingsWidget.driverMap.get(carIdx);
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!driver) {
    return null;
  }

  const position =
    settings.viewMode === 'all'
      ? driver.livePosition
      : driver.liveClassPosition;

  const change = settings.showLivePosChange
    ? standingsWidget.positionChanges.get(carIdx)
    : undefined;

  return (
    <div
      className={`${styles.cell} ${styles.posCell}`}
      style={{
        borderLeft: `3px solid ${driver.carClassColor}`,
        background: driver.isPlayer
          ? undefined
          : `linear-gradient(to right, color-mix(in srgb, ${driver.carClassColor} 20%, transparent), transparent)`,
      }}
    >
      {change === 'up' && (
        <ChevronUp className={styles.livePosArrowUp} size={ARROW_SIZE_PX} />
      )}

      {change === 'down' && (
        <ChevronDown className={styles.livePosArrowDown} size={ARROW_SIZE_PX} />
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
