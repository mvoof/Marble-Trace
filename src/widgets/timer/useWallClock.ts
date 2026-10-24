import { useEffect, useState } from 'react';

import { formatPcDate, formatWallClock } from '@shared/lib/timer-utils';

const WALL_CLOCK_INTERVAL_MS = 1000;

export const useWallClock = () => {
  const [wallClock, setWallClock] = useState(() => ({
    time: formatWallClock(new Date()),
    date: formatPcDate(new Date()),
  }));

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const time = formatWallClock(now);
      const date = formatPcDate(now);

      // The tick is per second but the readout is per minute: handing React
      // the same object skips the render for the 59 ticks that change nothing.
      setWallClock((previous) => {
        if (previous.time === time && previous.date === date) {
          return previous;
        }

        return { time, date };
      });
    }, WALL_CLOCK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return wallClock;
};
