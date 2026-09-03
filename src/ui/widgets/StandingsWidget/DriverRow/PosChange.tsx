import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import { hasRaceStarted } from '@utils/timer-utils';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './DriverRow.module.scss';
import {
  useSessionStore,
  useStandingsWidgetStore,
} from '@store/root-store-context';

interface PosChangeProps {
  carIdx: number;
}

export const PosChange = observer(({ carIdx }: PosChangeProps) => {
  const standingsWidget = useStandingsWidgetStore();
  const { session } = useSessionStore();

  const driver = standingsWidget.driverMap.get(carIdx);
  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  if (!driver) {
    return null;
  }

  // Until the green flag the field is still filling the grid, and a car that has
  // not loaded yet holds no rank while it still holds a grid slot — the two sides
  // of the subtraction count different fields, so everyone behind a missing car
  // reads a gain nobody made, drifting as the rest of the field appears. Nobody
  // has gained anything before the start anyway, so there is nothing to show.
  if (!hasRaceStarted(session?.session_state ?? null)) {
    return <span className={styles.posChangeNeutral}>-</span>;
  }

  const useClassPos = settings.viewMode !== 'all';

  // Rank as drawn, not as reported: the ± must change together with the row
  // sliding into its new place, otherwise it contradicts the table around it.
  const rank = standingsWidget.renderedRanks.get(carIdx);

  const position = useClassPos
    ? (rank?.inClass ?? driver.liveClassPosition)
    : (rank?.overall ?? driver.livePosition);

  const startPos = useClassPos ? driver.startPosClass : driver.startPosOverall;

  // No grid slot, or a car the sim has not placed at all: nothing to subtract.
  if (startPos <= 0 || position <= 0) {
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
