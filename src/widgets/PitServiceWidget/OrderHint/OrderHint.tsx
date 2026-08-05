import { observer } from 'mobx-react-lite';

import styles from './OrderHint.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import {
  usePitServiceWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const FULL_ORDER_LABEL = 'FUEL + 4 TIRES';

const RESULT_LABEL = {
  sent: 'ORDER SENT',
  failed: 'ORDER FAILED',
} as const;

/**
 * What the full-order hotkey would do, and how the last press went. The sim
 * never acknowledges a broadcast, so "sent" means the message left this app —
 * the tire checkboxes above are the real confirmation.
 */
export const OrderHint = observer(() => {
  const pitService = usePitServiceWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const { enableCommands, applyOrderHotkey } =
    widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

  const result = pitService.lastOrderResult;

  // The per-checkbox hotkeys and the clicks report through the same line, so it
  // stays around for them even when no full-order key is bound.
  if (!enableCommands || (!applyOrderHotkey && result === null)) {
    return null;
  }

  return (
    <div className={styles.hint}>
      {applyOrderHotkey && (
        <>
          <span className={styles.key}>{applyOrderHotkey}</span>

          <span className={styles.action}>{FULL_ORDER_LABEL}</span>
        </>
      )}

      {result !== null && (
        <span
          className={
            result === 'sent' ? styles.resultSent : styles.resultFailed
          }
        >
          {RESULT_LABEL[result]}
        </span>
      )}
    </div>
  );
});
