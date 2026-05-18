import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import type { RadarDistances } from '../../../types/bindings';
import { RadarDisplay } from './RadarDisplay/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

const RADAR_RENDER_RANGE = 10;

interface ProximityRadarWidgetProps {
  radarDistances: RadarDistances;
  spotterLeft: boolean;
  spotterRight: boolean;
  formatDistance: (meters: number) => string;
  distanceUnit: string;
}

export const ProximityRadarWidget = ({
  radarDistances,
  spotterLeft,
  spotterRight,
  formatDistance,
  distanceUnit,
}: ProximityRadarWidgetProps) => (
  <WidgetPanel className={styles.root} minWidth={100} gap={0}>
    <RadarDisplay
      radarDistances={radarDistances}
      spotterLeft={spotterLeft}
      spotterRight={spotterRight}
      renderRange={RADAR_RENDER_RANGE}
      formatDistance={formatDistance}
      distanceUnit={distanceUnit}
    />
  </WidgetPanel>
);
