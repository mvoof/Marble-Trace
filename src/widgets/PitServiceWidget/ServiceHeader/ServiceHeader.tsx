import { observer } from 'mobx-react-lite';

import styles from './ServiceHeader.module.scss';
import { resolveServiceState } from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';

const STATE_LABEL = {
  idle: 'NO ORDER',
  armed: 'ARMED',
  servicing: 'IN BOX',
  towing: 'TOWING',
} as const;

const MANUAL_LABEL = 'MANUAL';

export const ServiceHeader = observer(() => {
  const { pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();

  const state = resolveServiceState(pitService, widget.isInPitStall);
  const mode = widget.autoModeLabel;

  return (
    <header className={styles.header}>
      <span className={styles.title}>PIT SERVICE</span>

      {/*
        Names the halves auto mode still owns — FUEL AUTO once the tires have
        been picked by hand, TIRE AUTO once the fuel has. Absent entirely while
        auto mode is off in the settings.
      */}
      {mode !== null && (
        <span
          className={`${styles.mode} ${mode === MANUAL_LABEL ? styles.modeManual : styles.modeAuto}`}
        >
          {mode}
        </span>
      )}

      <span className={`${styles.state} ${styles[state]}`}>
        {STATE_LABEL[state]}
      </span>
    </header>
  );
});
