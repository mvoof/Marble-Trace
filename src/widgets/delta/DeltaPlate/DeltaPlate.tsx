import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import styles from './DeltaPlate.module.scss';

interface Props {
  children: ReactNode;
}

/**
 * The plate the number sits on — the background and the border the user picked,
 * painted here rather than by the container, which the manifest registers as
 * transparent. Nothing else in the widget carries that plate: the delta bar is
 * drawn straight onto the sim's own image, and a plate stretched behind it
 * would swallow the scale it draws.
 */
export const DeltaPlate = observer(({ children }: Props) => (
  <div className={styles.plate}>{children}</div>
));
