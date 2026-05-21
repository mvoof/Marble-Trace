import { observer } from 'mobx-react-lite';

import { GAxisColumn } from './GAxisColumn/GAxisColumn';

import styles from './GMeterDashboard.module.scss';

export const GMeterDashboard = observer(() => (
  <div className={styles.dashboard}>
    <GAxisColumn axis="lat" hasDivider />

    <GAxisColumn axis="lon" />
  </div>
));
