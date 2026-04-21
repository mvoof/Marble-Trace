import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeFuel } from './fuel-utils';
import { FuelWidget } from './FuelWidget';

const MAX_HISTORY = 20;

export const FuelWidgetContainer = observer(() => {
  const carStatus = telemetryStore.carStatus;
  const lap = telemetryStore.lapTiming;
  const session = telemetryStore.session;
  const driverInfo = telemetryStore.driverInfo;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const sessionNum = session?.session_num ?? null;

  const settings = widgetSettingsStore.getFuelSettings();

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const carIdx = telemetryStore.carIdx;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null ? (sessions[sessionNum]?.SessionLaps ?? null) : null;

  const [lapFuelHistory, setLapFuelHistory] = useState<number[]>([]);
  const lastLapRef = useRef<number | null>(null);
  const lapStartFuelRef = useRef<number | null>(null);

  useEffect(() => {
    const fuelLevel = carStatus?.fuel_level ?? null;
    if (currentLap === null || fuelLevel === null) return;

    if (lastLapRef.current === null) {
      lastLapRef.current = currentLap;
      lapStartFuelRef.current = fuelLevel;
      return;
    }

    if (currentLap !== lastLapRef.current) {
      if (lapStartFuelRef.current !== null) {
        const used = lapStartFuelRef.current - fuelLevel;
        if (used > 0 && used < 20) {
          setLapFuelHistory((prev) => {
            const next = [...prev, used];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
          });
        }
      }
      lastLapRef.current = currentLap;
      lapStartFuelRef.current = fuelLevel;
    }
  }, [currentLap, carStatus?.fuel_level]);

  const calc = computeFuel({
    fuelLevel: carStatus?.fuel_level ?? null,
    fuelUsePerHour: carStatus?.fuel_use_per_hour ?? null,
    fuelKgPerLtr: driverInfo?.DriverCarFuelKgPerLtr ?? null,
    bestLapTimeSec: lap?.lap_best_lap_time ?? null,
    lastLapTimeSec: lap?.lap_last_lap_time ?? null,
    currentLap,
    totalLaps,
    sessionTimeRemain: session?.session_time_remain ?? null,
    lapDistPct: lap?.lap_dist_pct ?? null,
    pitWarningLaps: settings.pitWarningLaps,
  });

  return (
    <FuelWidget
      fuelLevel={carStatus?.fuel_level ?? null}
      fuelMax={driverInfo?.DriverCarFuelMaxLtr ?? null}
      avgPerLap={calc.avgPerLap}
      lapsRemaining={calc.lapsRemaining}
      shortage={calc.shortage}
      fuelToAddWithBuffer={calc.fuelToAddWithBuffer}
      fuelSavePerLap={calc.fuelSavePerLap}
      pitWarning={calc.pitWarning}
      lapsToFinish={calc.lapsToFinish}
      pitWindowStart={calc.pitWindowStart}
      pitWindowEnd={calc.pitWindowEnd}
      showChart={settings.showChart}
      lapFuelHistory={lapFuelHistory}
    />
  );
});
