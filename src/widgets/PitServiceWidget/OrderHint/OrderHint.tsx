import { observer } from 'mobx-react-lite';

import styles from './OrderHint.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import {
  usePitServiceWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const TIRE_LABEL: Record<PitServiceWidgetSettings['commandTires'], string> = {
  none: 'FUEL',
  all: 'FUEL + 4 TIRES',
  fronts: 'FUEL + FRONTS',
  rears: 'FUEL + REARS',
};

const RESULT_LABEL = {
  sent: 'ORDER SENT',
  failed: 'ORDER FAILED',
} as const;

/**
 * What the apply hotkey would do, and how the last press went. The sim never
 * acknowledges a broadcast, so "sent" means the message left this app — the
 * tire checkboxes above are the real confirmation.
 */
export const OrderHint = observer(() => {
  const pitService = usePitServiceWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const { enableCommands, commandTires, applyOrderHotkey } =
    widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

  if (!enableCommands || !applyOrderHotkey) {
    return null;
  }

  const result = pitService.lastOrderResult;

  return (
    <div className={styles.hint}>
      <span className={styles.key}>{applyOrderHotkey}</span>

      <span className={styles.action}>{TIRE_LABEL[commandTires]}</span>

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
