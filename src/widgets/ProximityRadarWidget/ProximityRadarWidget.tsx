import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { RadarDisplay } from './RadarDisplay/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

export const ProximityRadarWidget = observer(() => (
  <WidgetPanel className={styles.root} minWidth={100} gap={0}>
    <RadarDisplay />
  </WidgetPanel>
));
