import { useEffect, useState } from 'react';

import { formatPcDate, formatWallClock } from '@utils/widget/timer-utils';

const WALL_CLOCK_INTERVAL_MS = 1000;

export const useWallClock = () => {
  const [wallClock, setWallClock] = useState(() => ({
    time: formatWallClock(new Date()),
    date: formatPcDate(new Date()),
  }));

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();

      setWallClock({
        time: formatWallClock(now),
        date: formatPcDate(now),
      });
    }, WALL_CLOCK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return wallClock;
};
