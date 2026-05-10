import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { RelativeWidget } from './RelativeWidget';

export const RelativeWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();
  const entries = computedStore.relativeEntries;

  return <RelativeWidget entries={entries} settings={settings} />;
});
