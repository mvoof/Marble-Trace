import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { LinearMap } from './LinearMap/LinearMap';

import styles from './RelativeMapWidget.module.scss';

export const RelativeMapWidget = observer(function RelativeMapWidget() {
  return (
    <WidgetPanel className={styles.linearMapWidget} gap={0} minWidth={0}>
      <LinearMap />
    </WidgetPanel>
  );
});
