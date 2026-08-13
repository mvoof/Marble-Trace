import { observer } from 'mobx-react-lite';

import styles from './TowRow.module.scss';
import {
  countdownUnit,
  formatCountdown,
} from '@widgets/PitServiceWidget/pit-service-utils';
import { usePitServiceWidgetStore } from '@store/root-store-context';

export const TowRow = observer(() => {
  const widget = usePitServiceWidgetStore();

  return (
    <div className={styles.tow}>
      <div className={styles.row}>
        <span className={styles.label}>TOW TIME</span>

        <span className={styles.value}>
          {formatCountdown(widget.towTimeS)}
          <span className={styles.unit}>{countdownUnit(widget.towTimeS)}</span>
        </span>
      </div>

      <span className={styles.hint}>SERVICE WILL APPLY ON ARRIVAL</span>
    </div>
  );
});
