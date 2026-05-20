import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { LinearMap } from './LinearMap/LinearMap';

import styles from './RelativeMapWidget.module.scss';

export const RelativeMapWidget = observer(() => {
  const settings = widgetSettingsStore.getLinearMapSettings();
  const entries = computedStore.relativeEntries;
  const player = entries.find((entry) => entry.isPlayer) ?? null;
  const isHorizontal = settings.orientation === 'horizontal';

  return (
    <WidgetPanel className={styles.linearMapWidget} gap={0} minWidth={0}>
      <LinearMap
        entries={entries}
        player={player}
        isHorizontal={isHorizontal}
        playerDotColor={settings.playerDotColor}
        targetDotRadiusPx={settings.targetDotRadiusPx}
      />
    </WidgetPanel>
  );
});
