import { GAxisColumn } from './GAxisColumn/GAxisColumn';

import styles from './GMeterDashboard.module.scss';

export const GMeterDashboard = () => (
  <div className={styles.dashboard}>
    <GAxisColumn axis="lat" hasDivider />

    <GAxisColumn axis="lon" />
  </div>
);
