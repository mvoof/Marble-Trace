import { WidgetPanel } from '../primitives';
import type { LinearMapWidgetSettings } from '../../../store/widget-settings.store';
import { LinearMap } from './LinearMap/LinearMap';
import type { DriverEntry } from '../widget-utils';

import styles from './LinearMapWidget.module.scss';

interface LinearMapWidgetProps {
  entries: DriverEntry[];
  settings: LinearMapWidgetSettings;
}

export const LinearMapWidget = ({
  entries,
  settings,
}: LinearMapWidgetProps) => {
  const player = entries.find((e) => e.isPlayer) ?? null;
  const isHorizontal = settings.orientation === 'horizontal';

  return (
    <WidgetPanel className={styles.linearMapWidget} gap={0}>
      <LinearMap
        entries={entries}
        player={player}
        isHorizontal={isHorizontal}
      />
    </WidgetPanel>
  );
};
