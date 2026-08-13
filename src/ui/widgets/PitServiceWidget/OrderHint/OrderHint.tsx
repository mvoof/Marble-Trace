import { observer } from 'mobx-react-lite';

import styles from './OrderHint.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

const RESULT_LABEL = {
  sent: 'ORDER SENT',
  failed: 'ORDER FAILED',
} as const;

/**
 * How the last order went. The sim never acknowledges a broadcast, so "sent"
 * means the message left this app — the tire checkboxes above are the real
 * confirmation.
 */
export const OrderHint = observer(() => {
  const pitService = usePitServiceWidgetStore();

  const result = pitService.order.lastOrderResult;

  if (result === null) {
    return null;
  }

  return (
    <div className={styles.hint}>
      <span
        className={result === 'sent' ? styles.resultSent : styles.resultFailed}
      >
        {RESULT_LABEL[result]}
      </span>
    </div>
  );
});
