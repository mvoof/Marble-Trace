import { WidgetPanel } from '../primitives/WidgetPanel';
import type { RadarDistances } from '../../../types/bindings';
import { RadarDisplay } from './RadarDisplay/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

const RADAR_RENDER_RANGE = 10;

interface ProximityRadarWidgetProps {
  radarDistances: RadarDistances;
  spotterLeft: boolean;
  spotterRight: boolean;
}

export const ProximityRadarWidget = ({
  radarDistances,
  spotterLeft,
  spotterRight,
}: ProximityRadarWidgetProps) => (
  <WidgetPanel className={styles.root} minWidth={100} gap={0}>
    <RadarDisplay
      radarDistances={radarDistances}
      spotterLeft={spotterLeft}
      spotterRight={spotterRight}
      renderRange={RADAR_RENDER_RANGE}
    />
  </WidgetPanel>
);
