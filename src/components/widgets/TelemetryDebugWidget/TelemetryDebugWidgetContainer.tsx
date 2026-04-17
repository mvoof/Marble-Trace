import { observer } from 'mobx-react-lite';

import {
  telemetryConnectionStore,
  telemetryStore,
} from '../../../store/iracing';
import { TelemetryDebugWidget } from './TelemetryDebugWidget';

export const TelemetryDebugWidgetContainer = observer(() => (
  <TelemetryDebugWidget
    status={telemetryConnectionStore.status}
    carDynamics={telemetryStore.carDynamics}
    carInputs={telemetryStore.carInputs}
    carStatus={telemetryStore.carStatus}
    lapTiming={telemetryStore.lapTiming}
    session={telemetryStore.session}
    driverInfo={telemetryStore.driverInfo}
    weekendInfo={telemetryStore.weekendInfo}
    environment={telemetryStore.environment}
  />
));
