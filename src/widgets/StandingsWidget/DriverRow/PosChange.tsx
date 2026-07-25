import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './DriverRow.module.scss';
import {
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface PosChangeProps {
  carIdx: number;
}

export const PosChange = observer(({ carIdx }: PosChangeProps) => {
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const driver = standingsWidget.driverMap.get(carIdx);
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!driver) {
    return null;
  }

  const useClassPos = settings.viewMode !== 'all';

  // Rank as drawn, not as reported: the ± must change together with the row
  // sliding into its new place, otherwise it contradicts the table around it.
  const rank = standingsWidget.renderedRanks.get(carIdx);

  const position = useClassPos
    ? (rank?.inClass ?? driver.liveClassPosition)
    : (rank?.overall ?? driver.livePosition);

  const startPos = useClassPos ? driver.startPosClass : driver.startPosOverall;

  if (startPos === 0) {
    return <span className={styles.posChangeNeutral}>-</span>;
  }

  const diff = startPos - position;

  if (diff > 0) {
    return (
      <span className={styles.posChangeUp}>
        <ChevronUp size={12} />
        {diff}
      </span>
    );
  }

  if (diff < 0) {
    return (
      <span className={styles.posChangeDown}>
        <ChevronDown size={12} />
        {Math.abs(diff)}
      </span>
    );
  }

  return <span className={styles.posChangeNeutral}>-</span>;
});
