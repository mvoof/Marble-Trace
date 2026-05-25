import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { RefsColumn } from './RefsColumn/RefsColumn';
import styles from './LapTimesWidget.module.scss';

export const LapTimesWidget = observer(() => {
  return (
    <WidgetPanel minWidth={0} gap={0}>
      <div className={styles.layout}>
        <RefsColumn />
      </div>
    </WidgetPanel>
  );
});
