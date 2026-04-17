import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeRelativeEntries } from '../RelativeWidget/relative-utils';
import { LinearMapWidget } from './LinearMapWidget';

export const LinearMapWidgetContainer = observer(() => {
  const entries = computeRelativeEntries(
    telemetryStore.carIdx,
    telemetryStore.driverInfo
  );
  const settings = widgetSettingsStore.getLinearMapSettings();

  return <LinearMapWidget entries={entries} settings={settings} />;
});
