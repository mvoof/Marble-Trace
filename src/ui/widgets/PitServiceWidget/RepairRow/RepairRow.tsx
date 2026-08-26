import { observer } from 'mobx-react-lite';
import { Hammer, Timer, Wrench } from 'lucide-react';

import styles from './RepairRow.module.scss';
import {
  countdownUnit,
  formatCountdown,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';

const ICON_SIZE = 13;

/**
 * The stop, timed. Takes the speed row's slot while the car is stationary: the
 * speed is zero and the numbers that matter are the two repair countdowns and
 * how long the crew has been at it.
 */
export const RepairRow = observer(() => {
  const { pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();

  const repair = pitService?.repairLeftS ?? 0;
  const optRepair = pitService?.optRepairLeftS ?? 0;

  // The sim exposes no service duration, so the stop is timed here, counting up
  // from the moment the car stops in the box. Once it rolls again the row hands
  // the slot back to the speed — which is the number pit exit is about.
  const serviceTime = widget.panel.stopElapsedS;

  return (
    <div className={styles.repairs}>
      <div className={`${styles.cell} ${styles.cellLive}`}>
        <Timer size={ICON_SIZE} className={styles.icon} />

        {/*
          Same formatter as the repair countdowns: a long stop shown as raw
          seconds reads as a number rather than a duration — "146" is a
          different thought from "2:26".
        */}
        <span className={styles.value}>
          {formatCountdown(serviceTime)}
          {countdownUnit(serviceTime)}
        </span>
      </div>

      {/*
        Two separate iRacing timers, shown only while they actually run:
        `PitRepairLeft` is the repair the car cannot leave without,
        `PitOptRepairLeft` is bodywork the driver may skip. Aero-only damage
        puts everything in the optional one and leaves the required one at zero.
      */}
      {repair > 0 && (
        <div className={`${styles.cell} ${styles.cellRequired}`}>
          <Wrench size={ICON_SIZE} className={styles.icon} />

          <span className={styles.value}>
            {formatCountdown(repair)}
            {countdownUnit(repair)}
          </span>
        </div>
      )}

      {optRepair > 0 && (
        <div className={`${styles.cell} ${styles.cellOptional}`}>
          <Hammer size={ICON_SIZE} className={styles.icon} />

          <span className={styles.value}>
            {formatCountdown(optRepair)}
            {countdownUnit(optRepair)}
          </span>
        </div>
      )}
    </div>
  );
});
