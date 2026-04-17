import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeDriverEntries, sortByRelativeLapDist } from '../widget-utils';
import { LinearMapWidget } from './LinearMapWidget';

export const LinearMapWidgetContainer = observer(() => {
  const playerCarIdx = telemetryStore.driverInfo?.DriverCarIdx ?? -1;
  const entries = sortByRelativeLapDist(
    computeDriverEntries(telemetryStore.carIdx, telemetryStore.driverInfo),
    playerCarIdx
  );
  const settings = widgetSettingsStore.getLinearMapSettings();

  return <LinearMapWidget entries={entries} settings={settings} />;
});
