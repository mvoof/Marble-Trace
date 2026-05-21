import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { LinearMap } from './LinearMap/LinearMap';

import styles from './RelativeMapWidget.module.scss';

export const RelativeMapWidget = observer(() => (
  <WidgetPanel className={styles.linearMapWidget} gap={0} minWidth={0}>
    <LinearMap />
  </WidgetPanel>
));
