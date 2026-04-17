import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { computeRelativeEntries } from './relative-utils';
import { RelativeWidget } from './RelativeWidget';

export const RelativeWidgetContainer = observer(() => {
  const entries = computeRelativeEntries(
    telemetryStore.carIdx,
    telemetryStore.driverInfo
  );

  return <RelativeWidget entries={entries} />;
});
