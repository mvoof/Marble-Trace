import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { RadarBarsContent } from './RadarBarsContent/RadarBarsContent';

import styles from './RadarBarWidget.module.scss';

export const RadarBarWidget = observer(() => (
  <WidgetPanel
    className={styles.root}
    minWidth={60}
    gap={0}
    direction="row"
    edgeInset
  >
    <RadarBarsContent />
  </WidgetPanel>
));
