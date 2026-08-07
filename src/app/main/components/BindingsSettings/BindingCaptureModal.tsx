import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import { reaction } from 'mobx';
import { ACTION_BY_ID } from '@store/hotkeys/actions';
import type { Binding } from '@store/hotkeys/binding-types';
import {
  useBindingsStore,
  useBindingsUiStore,
  useDeviceInputStore,
} from '@store/root-store-context';
import { actionLabel } from './binding-labels';
import { toAccelerator } from './accelerator';
import styles from './BindingsSettings.module.scss';

export const BindingCaptureModal = observer(() => {
  const bindings = useBindingsStore();
  const bindingsUi = useBindingsUiStore();
  const deviceInput = useDeviceInputStore();
  const { t } = useTranslation('main-app');

  const actionId = bindingsUi.captureActionId;

  // Keyboard capture is a DOM concern, so it lives in a hook rather than a
  // store. Capture phase, so nothing else in the settings page reacts first.
  useEffect(() => {
    if (!actionId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        bindingsUi.cancelCapture();

        return;
      }

      const accelerator = toAccelerator(event);

      if (!accelerator) return;

      bindings.addBinding(actionId, { kind: 'keyboard', accelerator });
      bindingsUi.cancelCapture();
    };

    window.addEventListener('keydown', onKeyDown, true);

    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [actionId, bindings, bindingsUi]);

  // Device buttons arrive as store updates rather than DOM events, so the modal
  // watches the last edge instead of subscribing to Tauri a second time. Only
  // presses bind — releasing the same button would immediately rebind it.
  useEffect(() => {
    if (!actionId) return;

    return reaction(
      () => deviceInput.lastEvent,
      (event) => {
        if (!event?.pressed) return;

        const binding: Binding = {
          kind: 'device',
          deviceId: event.deviceId,
          button: event.button,
        };

        bindings.addBinding(actionId, binding);
        bindingsUi.cancelCapture();
      }
    );
  }, [actionId, bindings, bindingsUi, deviceInput]);

  const action = actionId ? ACTION_BY_ID.get(actionId) : undefined;

  return (
    <Modal
      open={bindingsUi.isCapturing}
      footer={null}
      title={t('bindings.captureTitle')}
      onCancel={() => bindingsUi.cancelCapture()}
    >
      {action && (
        <div className={styles.captureTarget}>{actionLabel(action, t)}</div>
      )}

      <div className={styles.captureHint}>{t('bindings.captureHint')}</div>
    </Modal>
  );
});
