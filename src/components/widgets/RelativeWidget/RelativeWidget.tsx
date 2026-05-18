import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { RelativeList } from './RelativeList/RelativeList';

export const RelativeWidget = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();
  const entries = computedStore.relativeEntries;

  return <RelativeList entries={entries} settings={settings} />;
});
