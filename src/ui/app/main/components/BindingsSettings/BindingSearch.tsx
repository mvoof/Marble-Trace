import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { reaction } from 'mobx';
import { Button, Input, Tooltip } from 'antd';
import { Keyboard } from 'lucide-react';
import {
  useBindingsUiStore,
  useDeviceInputStore,
} from '@store/root-store-context';
import { bindingLabel } from './binding-labels';
import { toAccelerator } from './accelerator';
import styles from './BindingsSettings.module.scss';

/**
 * Search field with a "press the key" mode: rather than remembering how a key
 * is spelled, press it and the list narrows to whatever it is bound to. The
 * text it fills in is the same string the chips show, so the ordinary substring
 * search does the matching — no second code path.
 */
export const BindingSearch = observer(() => {
  const bindingsUi = useBindingsUiStore();
  const deviceInput = useDeviceInputStore();
  const { t } = useTranslation('main-app');

  const isListening = bindingsUi.isSearchingByKey;

  // Keyboard is a DOM concern, so it lives in a hook. Capture phase, so the
  // press narrows the list instead of typing into the input underneath.
  useEffect(() => {
    if (!isListening) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        bindingsUi.stopKeySearch();

        return;
      }

      const accelerator = toAccelerator(event);

      if (accelerator) {
        bindingsUi.setSearchFromKey(accelerator);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);

    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isListening, bindingsUi]);

  // Device buttons arrive as store updates rather than DOM events.
  useEffect(() => {
    if (!isListening) return;

    return reaction(
      () => deviceInput.lastEvent,
      (event) => {
        if (!event?.pressed) return;

        bindingsUi.setSearchFromKey(
          bindingLabel(
            { kind: 'device', deviceId: event.deviceId, button: event.button },
            deviceInput.deviceById(event.deviceId),
            t
          )
        );
      }
    );
  }, [isListening, bindingsUi, deviceInput, t]);

  return (
    <div className={styles.searchRow}>
      <Input
        className={styles.search}
        allowClear
        placeholder={
          isListening
            ? t('bindings.searchPressKey')
            : t('bindings.searchPlaceholder')
        }
        value={bindingsUi.search}
        onChange={(event) => bindingsUi.setSearch(event.target.value)}
      />

      <Tooltip title={t('bindings.searchByKeyHint')}>
        <Button
          size="small"
          type={isListening ? 'primary' : 'default'}
          icon={<Keyboard size={14} />}
          onClick={() =>
            isListening
              ? bindingsUi.stopKeySearch()
              : bindingsUi.startKeySearch()
          }
        >
          {t('bindings.searchByKey')}
        </Button>
      </Tooltip>
    </div>
  );
});
