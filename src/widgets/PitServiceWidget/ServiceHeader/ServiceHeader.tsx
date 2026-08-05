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

export const ServiceHeader = observer(() => {
  const { pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();

  const state = resolveServiceState(pitService, widget.isInPitStall);

  return (
    <header className={styles.header}>
      <span className={styles.title}>PIT SERVICE</span>

      <span className={`${styles.state} ${styles[state]}`}>
        {STATE_LABEL[state]}
      </span>
    </header>
  );
});
