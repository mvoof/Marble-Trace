import { WidgetPanel } from '../primitives/WidgetPanel';
import type { RadarSettings } from '../../../store/widget-settings.store';
import type { RadarDistances, SpotterState } from '../../../utils/proximity';
import { RadarBar } from './RadarBar/RadarBar';

import styles from './RadarBarWidget.module.scss';

interface RadarBarWidgetProps {
  radarDistances: RadarDistances;
  spotter: SpotterState;
  settings: RadarSettings;
}

export const RadarBarWidget = ({
  radarDistances,
  spotter,
  settings,
}: RadarBarWidgetProps) => {
  const sideCars = radarDistances.sideCars;
  const activeOnly = settings.barDisplayMode === 'active-only';
  const showLeft = activeOnly ? spotter.left : true;
  const showRight = activeOnly ? spotter.right : true;

  return (
    <WidgetPanel className={styles.root} minWidth={60} gap={0} direction="row">
      {showLeft && (
        <div className={styles.leftSlot}>
          <RadarBar
            active={spotter.left}
            dist={sideCars.leftDist ?? 0}
            side="left"
          />
        </div>
      )}

      {showRight && (
        <div className={styles.rightSlot}>
          <RadarBar
            active={spotter.right}
            dist={sideCars.rightDist ?? 0}
            side="right"
          />
        </div>
      )}
    </WidgetPanel>
  );
};
