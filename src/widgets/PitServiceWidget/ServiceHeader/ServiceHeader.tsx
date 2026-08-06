import { observer } from 'mobx-react-lite';

import styles from './ServiceHeader.module.scss';
import { resolveServiceState } from '@utils/widget/pit-service-utils';
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

const AUTO_LABEL = 'AUTO';
const MANUAL_LABEL = 'MANUAL';

export const ServiceHeader = observer(() => {
  const { pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();

  const state = resolveServiceState(pitService, widget.isInPitStall);

  return (
    <header className={styles.header}>
      <span className={styles.title}>PIT SERVICE</span>

      {/*
        Only shown once auto mode is switched on: with it off the order is
        manual by definition, and a permanent "MANUAL" plate would say nothing.
      */}
      {widget.isAutoEnabled && (
        <span
          className={`${styles.mode} ${widget.isAutoActive ? styles.modeAuto : styles.modeManual}`}
        >
          {widget.isAutoActive ? AUTO_LABEL : MANUAL_LABEL}
        </span>
      )}

      <span className={`${styles.state} ${styles[state]}`}>
        {STATE_LABEL[state]}
      </span>
    </header>
  );
});
