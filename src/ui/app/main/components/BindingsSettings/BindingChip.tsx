import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';
import { X } from 'lucide-react';
import type { Binding } from '@/types/input-bindings';
import {
  useBindingsStore,
  useDeviceInputStore,
} from '@store/root-store-context';
import { actionLabel, bindingLabel } from './binding-labels';
import styles from './BindingsSettings.module.scss';

interface BindingChipProps {
  actionId: string;
  binding: Binding;
}

export const BindingChip = observer(
  ({ actionId, binding }: BindingChipProps) => {
    const bindings = useBindingsStore();
    const deviceInput = useDeviceInputStore();
    const { t } = useTranslation('main-app');

    const conflicts = bindings.conflictingActions(actionId, binding);

    const isOffline =
      binding.kind === 'device' &&
      !deviceInput.isDeviceConnected(binding.deviceId);

    const device =
      binding.kind === 'device'
        ? deviceInput.deviceById(binding.deviceId)
        : undefined;

    const classNames = [styles.chip];

    if (conflicts.length > 0) {
      classNames.push(styles.chipConflicting);
    }

    if (isOffline) {
      classNames.push(styles.chipOffline);
    }

    // Conflicts are legitimate across widgets that never share a layout, so this
    // warns and never reassigns.
    const conflictTooltip =
      conflicts.length > 0
        ? t('bindings.conflictWith', {
            actions: conflicts
              .map((id) => {
                const action = bindings.registry.byId.get(id);

                return action ? actionLabel(action, bindings.registry, t) : id;
              })
              .join(', '),
          })
        : null;

    const tooltip = isOffline ? t('bindings.deviceOffline') : conflictTooltip;

    const chip = (
      <span className={classNames.join(' ')}>
        {bindingLabel(binding, device, t)}

        <button
          type="button"
          className={styles.chipRemove}
          aria-label={t('bindings.removeBinding')}
          onClick={() => bindings.removeBinding(actionId, binding)}
        >
          <X size={12} />
        </button>
      </span>
    );

    if (!tooltip) {
      return chip;
    }

    return <Tooltip title={tooltip}>{chip}</Tooltip>;
  }
);
