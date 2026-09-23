import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import { DriverRow } from '../DriverRow/DriverRow';

import styles from './RowsLayout.module.scss';

/** One row per driver, in the order the cars run: ahead, you, behind. */
export const RowsLayout = observer(() => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const hasAhead = wheelToWheel.shownAheadEntry !== null;
  const hasBehind = wheelToWheel.shownBehindEntry !== null;

  return (
    <div className={styles.rows}>
      {hasAhead && <DriverRow slot="ahead" />}
      <DriverRow slot="player" />
      {hasBehind && <DriverRow slot="behind" />}
    </div>
  );
});
