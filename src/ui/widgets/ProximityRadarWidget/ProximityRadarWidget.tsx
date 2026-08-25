import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { RadarScope } from './RadarScope/RadarScope';

import styles from './ProximityRadarWidget.module.scss';

export const ProximityRadarWidget = observer(() => (
  <WidgetPanel className={styles.root} minWidth={90} gap={0}>
    <RadarScope />
  </WidgetPanel>
));
