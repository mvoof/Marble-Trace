import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../store/units.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import { buildAllCorners } from './chassis-utils';
import { ChassisWidget } from './ChassisWidget';

export const ChassisWidgetContainer = observer(() => {
  const { chassis, carStatus } = telemetryStore;

  const { showInboard } = widgetSettingsStore.getChassisSettings();
  const widgetRef = useAutoSizeWidget('chassis');

  if (!chassis) return null;

  const { system } = unitsStore;
  const isMetric = system === 'metric';
  const corners = buildAllCorners(chassis, system);
  const onPitRoad = carStatus?.on_pit_road ?? false;

  return (
    <ChassisWidget
      ref={widgetRef}
      {...corners}
      tempUnit={isMetric ? '°C' : '°F'}
      lengthUnit={isMetric ? 'mm' : 'in'}
      showInboard={showInboard}
      onPitRoad={onPitRoad}
    />
  );
});
