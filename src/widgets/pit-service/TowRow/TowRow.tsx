import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import styles from './TowRow.module.scss';
import {
  countdownUnit,
  formatCountdown,
} from '@widgets/pit-service/pit-service-utils';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';
import { usePlayerStore } from '@entities/player/player-context';

/**
 * The tow, timed. The repairs the car will stand for on arrival ride beside the
 * countdown, so the whole wait reads off one row.
 */
export const TowRow = observer(() => {
  const widget = usePitServiceWidgetStore();
  const { pitService } = usePlayerStore();

  const repair = pitService?.repairLeftS ?? 0;
  const optRepair = pitService?.optRepairLeftS ?? 0;

  return (
    <div className={styles.tow}>
      <div className={styles.row}>
        <StatChip lead="TOW TIME" tone="danger" leadVariant="solid" />

        <span className={styles.value}>
          {formatCountdown(widget.towTimeS)}
          <span className={styles.unit}>{countdownUnit(widget.towTimeS)}</span>
        </span>
      </div>

      {(repair > 0 || optRepair > 0) && (
        <div className={styles.chips}>
          {repair > 0 && (
            <StatChip lead="REQ" tone="danger" size="xs">
              {formatCountdown(repair)}
              {countdownUnit(repair)}
            </StatChip>
          )}

          {optRepair > 0 && (
            <StatChip lead="OPT" tone="info" size="xs">
              {formatCountdown(optRepair)}
              {countdownUnit(optRepair)}
            </StatChip>
          )}
        </div>
      )}

      <span className={styles.hint}>SERVICE WILL APPLY ON ARRIVAL</span>
    </div>
  );
});
