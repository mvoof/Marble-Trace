import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { GMeterCanvas } from './GMeterCanvas/GMeterCanvas';
import { GMeterDashboard } from './GMeterDashboard/GMeterDashboard';

import styles from './GMeterWidget.module.scss';

export const GMeterWidget = observer(() => {
  return (
    <WidgetPanel minWidth={200} gap={0}>
      <div className={styles.root}>
        <GMeterCanvas />

        <GMeterDashboard />
      </div>
    </WidgetPanel>
  );
});
