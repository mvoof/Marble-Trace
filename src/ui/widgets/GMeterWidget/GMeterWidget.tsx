import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { GMeterCanvas } from './GMeterCanvas/GMeterCanvas';

import styles from './GMeterWidget.module.scss';

export const GMeterWidget = observer(() => {
  return (
    <WidgetPanel minWidth={80} gap={0}>
      <div className={styles.root}>
        <GMeterCanvas />
      </div>
    </WidgetPanel>
  );
});
