import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { RadarBar } from './RadarBar/RadarBar';

import styles from './RadarBarWidget.module.scss';

export const RadarBarWidget = observer(() => (
  <WidgetPanel
    className={styles.root}
    minWidth={60}
    gap={0}
    direction="row"
    edgeInset
  >
    <div className={styles.leftSlot}>
      <RadarBar side="left" />
    </div>

    <div className={styles.rightSlot}>
      <RadarBar side="right" />
    </div>
  </WidgetPanel>
));
