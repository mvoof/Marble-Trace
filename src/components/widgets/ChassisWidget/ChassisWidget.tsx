import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../store/units.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { buildAllCorners } from './chassis-utils';
import { ChassisLayout } from './ChassisLayout/ChassisLayout';

export const ChassisWidget = observer(() => {
  const { chassis, carStatus } = telemetryStore;
  const { showSuspensionAndBrakes } = widgetSettingsStore.getChassisSettings();
  const { system } = unitsStore;

  const isMetric = system === 'metric';
  const corners = buildAllCorners(chassis, system);
  const onPitRoad = carStatus?.on_pit_road ?? false;

  return (
    <ChassisLayout
      {...corners}
      tempUnit={isMetric ? '°C' : '°F'}
      lengthUnit={isMetric ? 'mm' : 'in'}
      showSuspensionAndBrakes={showSuspensionAndBrakes}
      onPitRoad={onPitRoad}
    />
  );
});
