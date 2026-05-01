import type { DriverEntry } from '../../../types/bindings';

export const computeRelativeGap = (
  driver: DriverEntry,
  player: DriverEntry
): number => {
  if (driver.isPlayer) return 0;

  const isAhead = driver.relativeLapDist > 0;
  const aheadClassLapTime = isAhead
    ? driver.classEstLapTime || driver.bestLapTime
    : player.classEstLapTime || player.bestLapTime;
  const behindClassLapTime = isAhead
    ? player.classEstLapTime || player.bestLapTime
    : driver.classEstLapTime || driver.bestLapTime;

  if (!aheadClassLapTime || !behindClassLapTime) {
    return driver.estTime - player.estTime;
  }

  const scalingRatio = behindClassLapTime / aheadClassLapTime;
  const aheadEstTime = isAhead ? driver.estTime : player.estTime;
  const behindEstTime = isAhead ? player.estTime : driver.estTime;
  const aheadTimeScaled = aheadEstTime * scalingRatio;
  const referenceLapTime = behindClassLapTime;

  let delta = isAhead
    ? behindEstTime - aheadTimeScaled
    : aheadTimeScaled - behindEstTime;

  if (isAhead) {
    if (delta > referenceLapTime / 2) delta -= referenceLapTime;
  } else {
    if (delta < -referenceLapTime / 2) delta += referenceLapTime;
  }

  return delta;
};
