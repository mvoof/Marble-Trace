import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { LinearMapWidget } from './LinearMapWidget';

export const LinearMapWidgetContainer = observer(() => {
  const standings = computedStore.standings;
  const settings = widgetSettingsStore.getLinearMapSettings();

  const entries = [...(standings?.entries ?? [])].sort(
    (a, b) => b.relativeLapDist - a.relativeLapDist
  );

  return <LinearMapWidget entries={entries} settings={settings} />;
});
