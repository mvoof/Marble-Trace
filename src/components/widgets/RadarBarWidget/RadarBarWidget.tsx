import { WidgetPanel } from '../primitives/WidgetPanel';
import type { RadarSettings } from '../../../store/widget-settings.store';
import type { RadarDistances } from '../../../types/bindings';
import { RadarBar } from './RadarBar/RadarBar';

import styles from './RadarBarWidget.module.scss';

interface RadarBarWidgetProps {
  radarDistances: RadarDistances;
  spotterLeft: boolean;
  spotterRight: boolean;
  settings: RadarSettings;
}

export const RadarBarWidget = ({
  radarDistances,
  spotterLeft,
  spotterRight,
  settings,
}: RadarBarWidgetProps) => {
  const { leftDist, rightDist } = radarDistances;
  const activeOnly = settings.barDisplayMode === 'active-only';
  const showLeft = activeOnly ? spotterLeft : true;
  const showRight = activeOnly ? spotterRight : true;

  return (
    <WidgetPanel className={styles.root} minWidth={60} gap={0} direction="row">
      {showLeft && (
        <div className={styles.leftSlot}>
          <RadarBar active={spotterLeft} dist={leftDist ?? 0} side="left" />
        </div>
      )}

      {showRight && (
        <div className={styles.rightSlot}>
          <RadarBar active={spotterRight} dist={rightDist ?? 0} side="right" />
        </div>
      )}
    </WidgetPanel>
  );
};
