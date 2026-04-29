import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore, telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { FuelWidget } from './FuelWidget';

const MAX_HISTORY = 20;

export const FuelWidgetContainer = observer(() => {
  const fuel = computedStore.fuel;
  const carStatus = telemetryStore.carStatus;
  const driverInfo = telemetryStore.driverInfo;

  const settings = widgetSettingsStore.getFuelSettings();

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const carIdx = telemetryStore.carIdx;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;

  const sessionNum = telemetryStore.session?.session_num ?? null;

  const [lapFuelHistory, setLapFuelHistory] = useState<number[]>([]);
  const lastLapRef = useRef<number | null>(null);
  const lapStartFuelRef = useRef<number | null>(null);
  const lastSessionNumRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionNum !== null && sessionNum !== lastSessionNumRef.current) {
      lastSessionNumRef.current = sessionNum;
      setLapFuelHistory([]);
      lastLapRef.current = null;
      lapStartFuelRef.current = null;
    }
  }, [sessionNum]);

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

  const fuelLevel = carStatus?.fuel_level ?? null;

  const historyAvg =
    lapFuelHistory.length >= 1
      ? lapFuelHistory.reduce((a, b) => a + b, 0) / lapFuelHistory.length
      : null;

  const lapsRemaining =
    historyAvg !== null && historyAvg > 0 && fuelLevel !== null
      ? fuelLevel / historyAvg
      : null;

  const pitWarning =
    lapsRemaining !== null && lapsRemaining < settings.pitWarningLaps;

  const fuelMax = driverInfo?.DriverCarFuelMaxLtr ?? null;
  const fuelToAddWithBuffer = fuel?.fuelToAddWithBuffer ?? null;
  const tankTooSmall =
    fuelToAddWithBuffer !== null &&
    fuelMax !== null &&
    fuelLevel !== null &&
    fuelToAddWithBuffer > fuelMax - fuelLevel;

  return (
    <FuelWidget
      fuelLevel={fuelLevel}
      fuelMax={fuelMax}
      avgPerLap={fuel?.avgPerLap ?? null}
      currentUsePerLap={fuel?.currentUsePerLap ?? null}
      lapsRemaining={lapsRemaining}
      shortage={fuel?.shortage ?? null}
      lapsToFinish={fuel?.lapsToFinish ?? null}
      fuelToAddWithBuffer={fuelToAddWithBuffer}
      fuelSavePerLap={fuel?.fuelSavePerLap ?? null}
      pitWarning={pitWarning}
      pitWindowStart={fuel?.pitWindowStart ?? null}
      pitWindowEnd={fuel?.pitWindowEnd ?? null}
      tankTooSmall={tankTooSmall}
      showChart={settings.showChart}
      chartType={settings.chartType}
      lapFuelHistory={lapFuelHistory}
    />
  );
});
