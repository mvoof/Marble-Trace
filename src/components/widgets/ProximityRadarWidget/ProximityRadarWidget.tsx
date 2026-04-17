import { WidgetPanel } from '../primitives/WidgetPanel';
import type { RadarDistances, SpotterState } from '../../../utils/proximity';
import { RadarDisplay } from './RadarDisplay/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

const RADAR_RENDER_RANGE = 10;

interface ProximityRadarWidgetProps {
  radarDistances: RadarDistances;
  spotter: SpotterState;
}

export const ProximityRadarWidget = ({
  radarDistances,
  spotter,
}: ProximityRadarWidgetProps) => (
  <WidgetPanel className={styles.root} minWidth={100} gap={0}>
    <RadarDisplay
      radarDistances={radarDistances}
      spotter={spotter}
      renderRange={RADAR_RENDER_RANGE}
    />
  </WidgetPanel>
);
