import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { RelativeContent } from './RelativeContent/RelativeContent';

import styles from './RelativeWidget.module.scss';

export const RelativeWidget = observer(() => (
  <WidgetPanel className={styles.relative} gap={0}>
    <RelativeContent />
  </WidgetPanel>
));
