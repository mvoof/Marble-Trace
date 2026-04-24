import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { RelativeWidget } from './RelativeWidget';

export const RelativeWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();
  const standings = computedStore.standings;

  const entries = [...(standings?.entries ?? [])].sort(
    (a, b) => b.relativeLapDist - a.relativeLapDist
  );

  return <RelativeWidget entries={entries} settings={settings} />;
});
