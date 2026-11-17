import { observer } from 'mobx-react-lite';

import { BindingsSettings } from './BindingsSettings';
import { DevicesSettings } from './DevicesSettings';
import styles from './HotkeysSection.module.scss';

/** Bindings, with the devices they use beside them. */
export const HotkeysSection = observer(() => (
  <div className={styles.columns}>
    <div className={styles.pane}>
      <BindingsSettings />
    </div>

    <div className={styles.pane}>
      <DevicesSettings />
    </div>
  </div>
));
