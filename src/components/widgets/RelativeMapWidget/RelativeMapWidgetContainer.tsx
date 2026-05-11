import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { RelativeMapWidget } from './RelativeMapWidget';

export const RelativeMapWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getLinearMapSettings();
  const entries = computedStore.relativeEntries;

  return <RelativeMapWidget entries={entries} settings={settings} />;
});
