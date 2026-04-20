import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../store/units.store';
import { buildAllCorners } from './chassis-utils';
import { ChassisWidget } from './ChassisWidget';

export const ChassisWidgetContainer = observer(() => {
  const { chassis } = telemetryStore;

  if (!chassis) return null;

  const { system } = unitsStore;
  const isMetric = system === 'metric';
  const corners = buildAllCorners(chassis, system);

  return (
    <ChassisWidget
      {...corners}
      tempUnit={isMetric ? '°C' : '°F'}
      lengthUnit={isMetric ? 'mm' : 'in'}
    />
  );
});
