import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeDriverEntries, sortByRelativeLapDist } from '../widget-utils';
import { RelativeWidget } from './RelativeWidget';

export const RelativeWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();
  const playerCarIdx = telemetryStore.driverInfo?.DriverCarIdx ?? -1;

  const entries = sortByRelativeLapDist(
    computeDriverEntries(telemetryStore.carIdx, telemetryStore.driverInfo),
    playerCarIdx
  );

  return <RelativeWidget entries={entries} settings={settings} />;
});
