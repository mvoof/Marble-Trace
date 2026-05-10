import { WidgetPanel } from '../primitives/WidgetPanel/WidgetPanel';
import type { LinearMapWidgetSettings } from '../../../types/widget-settings';
import { LinearMap } from './LinearMap/LinearMap';
import type { DriverEntry } from '../../../types/bindings';

import styles from './RelativeMapWidget.module.scss';

interface RelativeMapWidgetProps {
  entries: DriverEntry[];
  settings: LinearMapWidgetSettings;
}

export const RelativeMapWidget = ({
  entries,
  settings,
}: RelativeMapWidgetProps) => {
  const player = entries.find((e) => e.isPlayer) ?? null;
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
};
