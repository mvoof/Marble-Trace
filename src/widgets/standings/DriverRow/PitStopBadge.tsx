import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useStandingsWidgetStore } from '@widgets/standings/standings.store';
import { formatPitStopTime } from '@widgets/standings/standings-utils';

import styles from './PitStopBadge.module.scss';

interface PitStopBadgeProps {
  carIdx: number;
}

/**
 * The car's latest stop: the lap it came in on, then the time it spent on pit
 * road — counting while it is still there, the finished stop's total after.
 * The lap changes once a stop, so the badge is rendered from the identity; the
 * time is written straight to its span. See `docs/rendering.md`.
 */
export const PitStopBadge = observer(({ carIdx }: PitStopBadgeProps) => {
  const standingsWidget = useStandingsWidgetStore();
  const computed = useBackendComputedStore();

  const timeRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const liveDriver = computed.driverEntryOf(carIdx);

      if (!liveDriver) {
        return;
      }

      const seconds = liveDriver.pitElapsedS ?? liveDriver.lastPitS;

      scheduleWrite(() => {
        element.textContent = formatPitStopTime(seconds);
      });
    },
    [computed, carIdx]
  );

  const pitLap = standingsWidget.driverMap.get(carIdx)?.pitLap ?? null;

  if (pitLap === null) {
    return null;
  }

  return (
    <span className={styles.pitStopBadge}>
      <span className={styles.lap}>L{pitLap}</span>
      <span ref={timeRef} className={styles.time} />
    </span>
  );
});
