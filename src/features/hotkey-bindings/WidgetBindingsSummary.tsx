import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Keyboard } from 'lucide-react';
import { bindingKey } from '@shared/contracts/input-bindings';
import { useBindingsStore } from '@features/hotkey-bindings/bindings-context';
import { useDeviceInputStore } from '@features/hotkey-bindings/device-input-context';
import {
  actionLabel,
  bindingLabel,
} from '@features/hotkey-bindings/binding-labels';
import styles from './WidgetBindingsSummary.module.scss';

const ICON_SIZE = 14;

interface WidgetBindingsSummaryProps {
  widgetType: string;
  /** Opens the Hotkeys page on this widget: bindings are edited only there. */
  onOpenHotkeys: () => void;
}

/**
 * A widget type's bindings, read-only. They belong to the widget, not to the
 * copy being edited, so every copy shows the same ones.
 */
export const WidgetBindingsSummary = observer(
  ({ widgetType, onOpenHotkeys }: WidgetBindingsSummaryProps) => {
    const bindings = useBindingsStore();
    const deviceInput = useDeviceInputStore();
    const { t } = useTranslation('main-app');

    const rows = bindings.widgetBindings(widgetType);

    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <span className={styles.shared}>
            {t('widgetSettings.hotkeysShared')}
          </span>

          <Button
            size="small"
            icon={<Keyboard size={ICON_SIZE} />}
            onClick={onOpenHotkeys}
          >
            {t('widgetSettings.hotkeysChange')}
          </Button>
        </div>

        {rows.map(({ action, bindings: actionBindings }) => (
          <div key={action.id} className={styles.row}>
            <span className={styles.action}>
              {actionLabel(action, bindings.registry, t)}
            </span>

            <span className={styles.chips}>
              {actionBindings.length === 0 ? (
                <span className={styles.unbound}>{t('bindings.unbound')}</span>
              ) : (
                actionBindings.map((binding) => (
                  <span key={bindingKey(binding)} className={styles.chip}>
                    {bindingLabel(
                      binding,
                      binding.kind === 'device'
                        ? deviceInput.deviceById(binding.deviceId)
                        : undefined,
                      t
                    )}
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }
);
