import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import styles from './ToolbarCluster.module.scss';

/** A sunken box that holds controls belonging together: `tb-cluster`. */
export const ToolbarCluster = observer(
  ({ children }: { children: ReactNode }) => (
    <div className={styles.cluster}>{children}</div>
  )
);

/** A hairline between the groups of the bar: `tb-sep`. */
export const ToolbarSeparator = observer(() => (
  <span className={styles.separator} aria-hidden />
));
