import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import styles from './DeltaPlate.module.scss';

interface Props {
  children: ReactNode;
  /** Extra class on the plate itself — how the caller anchors or shifts it. */
  className?: string;
}

/**
 * The plate the number sits on — the background and the border the user picked,
 * painted here rather than by the container, which the manifest registers as
 * transparent. Nothing else in the widget carries a plate: the delta bar is
 * drawn straight onto the sim's own image, and a plate stretched behind it
 * would swallow the scale it draws.
 */
export const DeltaPlate = observer(({ children, className = '' }: Props) => (
  <div className={`${styles.plate} ${className}`}>{children}</div>
));
