import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { computedStore } from '../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { FuelDisplay } from './FuelDisplay/FuelDisplay';

export const FuelWidget = observer(() => {
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

  return (
    <FuelDisplay
      fuelLevel={fuelLevel}
      fuelMax={fuelMax}
      avgPerLap={fuel?.avgPerLap ?? null}
      lapsRemaining={lapsRemaining}
      shortage={fuel?.shortage ?? null}
      fuelToAddWithBuffer={fuelToAddWithBuffer}
      pitWarning={pitWarning}
      pitWindowStart={fuel?.pitWindowStart ?? null}
      pitWindowEnd={fuel?.pitWindowEnd ?? null}
      showChart={settings.showChart}
      chartType={settings.showChart ? settings.chartType : 'bar'}
      barWidth={settings.barWidth}
      lapFuelHistory={fuel?.lapFuelHistory ?? []}
      pitWarningLaps={settings.pitWarningLaps}
    />
  );
});
