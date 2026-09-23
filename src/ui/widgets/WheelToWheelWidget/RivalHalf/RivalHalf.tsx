import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import { BattleSide } from '../BattleSide/BattleSide';
import { RivalRow } from '../RivalRow/RivalRow';

import styles from './RivalHalf.module.scss';

/**
 * The rival's half. One rival gets it whole; a rival on both sides splits it
 * in two, the car ahead on top — the order the two sit on track in.
 */
export const RivalHalf = observer(() => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  if (!wheelToWheel.isSplit) {
    return <BattleSide slot={wheelToWheel.singleSlot} />;
  }

  return (
    <div className={styles.split}>
      <RivalRow slot="ahead" />
      <div className={styles.divider} />
      <RivalRow slot="behind" />
    </div>
  );
});
