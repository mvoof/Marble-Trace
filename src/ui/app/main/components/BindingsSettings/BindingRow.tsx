import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Plus } from 'lucide-react';
import { ACTION_BY_ID } from '@store/hotkeys/actions';
import {
  useBindingsStore,
  useBindingsUiStore,
  useStore,
} from '@store/root-store-context';
import { bindingKey } from '@/types/input-bindings';
import { BindingChip } from './BindingChip';
import { actionLabel } from './binding-labels';
import styles from './BindingsSettings.module.scss';

interface BindingRowProps {
  actionId: string;
}

export const BindingRow = observer(({ actionId }: BindingRowProps) => {
  const bindings = useBindingsStore();
  const bindingsUi = useBindingsUiStore();
  const store = useStore();
  const { t } = useTranslation('main-app');

  const action = ACTION_BY_ID.get(actionId);

  if (!action) {
    return null;
  }

  const bound = bindings.bindingsFor(actionId);

  // A key whose setting is switched off would run and change nothing, so the
  // row says what to turn on instead of leaving the press unexplained.
  const isInert = action.isInert?.(store) === true;

  return (
    <div className={styles.row}>
      <div className={styles.rowTexts}>
        <div className={styles.rowLabel}>{actionLabel(action, t)}</div>

        {isInert && action.inertHintKey && (
          <div className={styles.rowHint}>
            {t(`bindings.inert.${action.inertHintKey}`)}
          </div>
        )}
      </div>

      <div className={styles.chips}>
        {bound.length === 0 ? (
          <span className={styles.empty}>{t('bindings.unbound')}</span>
        ) : (
          bound.map((binding) => (
            <BindingChip
              key={bindingKey(binding)}
              actionId={actionId}
              binding={binding}
            />
          ))
        )}

        <Button
          size="small"
          icon={<Plus size={12} />}
          aria-label={t('bindings.addBinding')}
          onClick={() => bindingsUi.startCapture(actionId)}
        />
      </div>
    </div>
  );
});
