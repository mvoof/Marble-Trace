import { observer } from 'mobx-react-lite';

import { useOverlayRoot } from '@app/roots/overlay-root-context';

import styles from './MonitorIdentifyFlash.module.scss';

/**
 * The monitor's number, big in the middle of the screen, while Identify runs.
 * Drawn beside the canvas rather than in it, so it shows even with every
 * widget hidden.
 */
export const MonitorIdentifyFlash = observer(() => {
  const { monitorIdentify } = useOverlayRoot();

  if (monitorIdentify.number === null) {
    return null;
  }

  return (
    <div className={styles.flash}>
      <span className={styles.number}>{monitorIdentify.number}</span>
    </div>
  );
});
