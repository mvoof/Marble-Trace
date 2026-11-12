import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeText } from '@shared/ui/live/live-parts';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { formatPitStopTime } from '@widgets/standings/standings-utils';

interface PitStopTimeProps {
  carIdx: number;
}

/**
 * The time the car has spent on pit road this stop, counting. It rides on the
 * pit badge, so it shows only while the car is there; the value changes every
 * bundle and is written straight to the span. See `docs/rendering.md`.
 */
export const PitStopTime = observer(({ carIdx }: PitStopTimeProps) => {
  const computed = useBackendComputedStore();

  const timeRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const liveDriver = computed.driverEntryOf(carIdx);

      if (!liveDriver) {
        return;
      }

      const seconds = liveDriver.pitElapsedS ?? liveDriver.lastPitS;

      scheduleWrite(() => {
        writeText(element, formatPitStopTime(seconds));
      });
    },
    [computed, carIdx]
  );

  return <span ref={timeRef} />;
});
