import { observer } from 'mobx-react-lite';

import styles from './RepairRow.module.scss';
import {
  countdownUnit,
  formatCountdown,
} from '@utils/widget/pit-service-utils';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';

export const RepairRow = observer(() => {
  const { pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();

  const repair = pitService?.repairLeftS ?? 0;
  const optRepair = pitService?.optRepairLeftS ?? 0;
  const available = pitService?.fastRepairsAvailable ?? 0;
  const used = pitService?.fastRepairsUsed ?? 0;

  // The sim exposes no service duration, so the stop is timed here: counting
  // up while in the box, then held as the total of the last stop.
  const isServicing = widget.isServiceActive;
  const serviceTime = isServicing
    ? widget.stopElapsedS
    : widget.lastStopDurationS;

  return (
    <div className={styles.repairs}>
      {serviceTime !== null && (
        <div className={`${styles.chip} ${isServicing ? styles.chipLive : ''}`}>
          <span className={styles.key}>
            {isServicing ? 'SERVICE' : 'TOTAL'}
          </span>

          <span className={styles.value}>{serviceTime.toFixed(1)} s</span>
        </div>
      )}

      {/*
        Two separate iRacing timers, shown only while they actually run:
        `PitRepairLeft` is the repair the car cannot leave without,
        `PitOptRepairLeft` is bodywork the driver may skip. Aero-only damage
        puts everything in the optional one and leaves the required one at zero.
      */}
      {repair > 0 && (
        <div className={`${styles.chip} ${styles.chipRequired}`}>
          <span className={styles.key}>REQ REPAIR</span>

          <span className={styles.value}>
            {formatCountdown(repair)}
            {countdownUnit(repair)}
          </span>
        </div>
      )}

      {optRepair > 0 && (
        <div className={`${styles.chip} ${styles.chipOptional}`}>
          <span className={styles.key}>OPT REPAIR</span>

          <span className={styles.value}>
            {formatCountdown(optRepair)}
            {countdownUnit(optRepair)}
          </span>
        </div>
      )}

      <div className={styles.chip}>
        <span className={styles.key}>FAST REPAIR</span>

        <span className={styles.value}>
          {used} / {available + used}
        </span>
      </div>
    </div>
  );
});
