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

  return (
    <FuelWidget
      fuelLevel={carStatus?.fuel_level ?? null}
      fuelMax={driverInfo?.DriverCarFuelMaxLtr ?? null}
      avgPerLap={fuel?.avgPerLap ?? null}
      lapsRemaining={fuel?.lapsRemaining ?? null}
      shortage={fuel?.shortage ?? null}
      lapsToFinish={fuel?.lapsToFinish ?? null}
      fuelToAddWithBuffer={fuel?.fuelToAddWithBuffer ?? null}
      fuelSavePerLap={fuel?.fuelSavePerLap ?? null}
      pitWarning={fuel?.pitWarning ?? false}
      pitWindowStart={fuel?.pitWindowStart ?? null}
      pitWindowEnd={fuel?.pitWindowEnd ?? null}
      showChart={settings.showChart}
      chartType={settings.chartType}
      lapFuelHistory={lapFuelHistory}
    />
  );
});
