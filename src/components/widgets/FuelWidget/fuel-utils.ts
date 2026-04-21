export interface FuelCalculations {
  avgPerLap: number | null;
  lapsRemaining: number | null;
  lapsToFinish: number | null;
  /** Shortage/surplus in liters: positive = surplus, negative = deficit */
  shortage: number | null;
  fuelToAdd: number | null;
  fuelToAddWithBuffer: number | null;
  /** Liters per lap to save when in deficit; null when surplus or unknown */
  fuelSavePerLap: number | null;
  pitWarning: boolean;
  pitWindowStart: number | null;
  pitWindowEnd: number | null;
}

export const computeFuel = (params: {
  fuelLevel: number | null;
  fuelUsePerHour: number | null;
  fuelKgPerLtr: number | null;
  bestLapTimeSec: number | null;
  lastLapTimeSec: number | null;
  currentLap: number | null;
  totalLaps: string | null;
  sessionTimeRemain: number | null;
  lapDistPct: number | null;
  pitWarningLaps: number;
}): FuelCalculations => {
  const {
    fuelLevel,
    fuelUsePerHour,
    fuelKgPerLtr,
    bestLapTimeSec,
    lastLapTimeSec,
    currentLap,
    totalLaps,
    sessionTimeRemain,
    lapDistPct,
    pitWarningLaps,
  } = params;

  if (fuelLevel === null || fuelUsePerHour === null || fuelUsePerHour <= 0) {
    return {
      avgPerLap: null,
      lapsRemaining: null,
      lapsToFinish: null,
      shortage: null,
      fuelToAdd: null,
      fuelToAddWithBuffer: null,
      fuelSavePerLap: null,
      pitWarning: false,
      pitWindowStart: null,
      pitWindowEnd: null,
    };
  }

  const lapTimeSec =
    (bestLapTimeSec !== null && bestLapTimeSec > 0 ? bestLapTimeSec : null) ??
    (lastLapTimeSec !== null && lastLapTimeSec > 0 ? lastLapTimeSec : null);

  if (lapTimeSec === null) {
    return {
      avgPerLap: null,
      lapsRemaining: null,
      lapsToFinish: null,
      shortage: null,
      fuelToAdd: null,
      fuelToAddWithBuffer: null,
      fuelSavePerLap: null,
      pitWarning: false,
      pitWindowStart: null,
      pitWindowEnd: null,
    };
  }

  const kgPerLtr = fuelKgPerLtr !== null && fuelKgPerLtr > 0 ? fuelKgPerLtr : 1;
  const usePerHourLtr = fuelUsePerHour / kgPerLtr;
  const avgPerLap = (usePerHourLtr / 3600) * lapTimeSec;

  if (avgPerLap <= 0) {
    return {
      avgPerLap: null,
      lapsRemaining: null,
      lapsToFinish: null,
      shortage: null,
      fuelToAdd: null,
      fuelToAddWithBuffer: null,
      fuelSavePerLap: null,
      pitWarning: false,
      pitWindowStart: null,
      pitWindowEnd: null,
    };
  }

  const lapsRemaining = fuelLevel / avgPerLap;

  // Кругов до конца: для lap-based — с учётом прогресса текущего круга.
  // Для time-based — из оставшегося времени.
  let lapsToFinish: number | null = null;

  const isTimedRace =
    totalLaps === null || totalLaps.toLowerCase() === 'unlimited';

  if (!isTimedRace && currentLap !== null) {
    const total = parseInt(totalLaps, 10);
    if (!isNaN(total)) {
      const progressFraction = lapDistPct !== null ? lapDistPct : 0;
      // total - currentLap даёт кругов включая текущий недоезженный
      // вычитаем уже пройденную долю текущего круга
      lapsToFinish = total - currentLap - progressFraction;
    }
  } else if (
    isTimedRace &&
    sessionTimeRemain !== null &&
    sessionTimeRemain > 0
  ) {
    lapsToFinish = sessionTimeRemain / lapTimeSec;
  }

  // Shortage in liters: positive = surplus, negative = deficit
  const fuelNeeded = lapsToFinish !== null ? lapsToFinish * avgPerLap : null;
  const shortage = fuelNeeded !== null ? fuelLevel - fuelNeeded : null;

  const fuelToAdd =
    fuelNeeded !== null ? Math.max(0, fuelNeeded - fuelLevel) : null;

  const fuelToAddWithBuffer =
    lapsToFinish !== null
      ? Math.max(0, (lapsToFinish + 1) * avgPerLap - fuelLevel)
      : null;

  // Pit window: when fuel runs out minus safety margin
  const pitWindowStart =
    currentLap !== null
      ? Math.floor(currentLap + lapsRemaining - pitWarningLaps)
      : null;
  const pitWindowEnd =
    currentLap !== null ? Math.floor(currentLap + lapsRemaining - 1) : null;

  const pitWarning =
    shortage !== null &&
    (shortage < 0 || shortage < pitWarningLaps * avgPerLap);

  // How much to save per remaining lap to avoid a pit stop
  const fuelSavePerLap =
    shortage !== null &&
    shortage < 0 &&
    lapsToFinish !== null &&
    lapsToFinish > 0
      ? Math.abs(shortage) / lapsToFinish
      : null;

  return {
    avgPerLap,
    lapsRemaining,
    lapsToFinish,
    shortage,
    fuelToAdd,
    fuelToAddWithBuffer,
    fuelSavePerLap,
    pitWarning,
    pitWindowStart,
    pitWindowEnd,
  };
};

export const formatFuelLiters = (v: number | null): string => {
  if (v === null) return '—';
  return v.toFixed(2) + ' L';
};

export const formatLaps = (v: number | null): string => {
  if (v === null) return '—';
  return v.toFixed(1);
};

export const formatShortage = (v: number | null): string => {
  if (v === null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
};
