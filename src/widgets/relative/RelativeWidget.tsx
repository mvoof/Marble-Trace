import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { RelativeContent } from './RelativeContent/RelativeContent';

import styles from './RelativeWidget.module.scss';

export const RelativeWidget = observer(() => {
  return (
    <WidgetPanel className={styles.relativeWidget} gap={0}>
      <RelativeContent />
    </WidgetPanel>
  );
});
