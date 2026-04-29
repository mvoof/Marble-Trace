import { observer } from 'mobx-react-lite';

import { computedStore, telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { FuelWidget } from './FuelWidget';

export const FuelWidgetContainer = observer(() => {
  const fuel = computedStore.fuel;
  const carStatus = telemetryStore.carStatus;
  const driverInfo = telemetryStore.driverInfo;

  const settings = widgetSettingsStore.getFuelSettings();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const fuelMax = driverInfo?.DriverCarFuelMaxLtr ?? null;

  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const fuelToAddWithBuffer = fuel?.fuelToAddWithBuffer ?? null;

  const pitWarning =
    lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps;

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
      lapFuelHistory={fuel?.lapFuelHistory ?? []}
      pitWarningLaps={settings.pitWarningLaps}
    />
  );
});
