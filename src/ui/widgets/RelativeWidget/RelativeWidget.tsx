import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { RelativeContent } from './RelativeContent/RelativeContent';

import styles from './RelativeWidget.module.scss';

export const RelativeWidget = observer(() => {
  return (
    // `styles.relative` is a CSS module class name, not the telemetry
    // store's `relative` field — the lint rule matches by property name alone.
    // oxlint-disable-next-line no-restricted-properties
    <WidgetPanel className={styles.relative} gap={0}>
      <RelativeContent />
    </WidgetPanel>
  );
});
