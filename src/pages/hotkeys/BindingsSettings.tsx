import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm } from 'antd';
import { useBindingsStore } from '@features/hotkey-bindings/bindings-context';
import { useBindingsUiStore } from '@features/hotkey-bindings/bindings-ui-context';
import { useDeviceInputStore } from '@features/hotkey-bindings/device-input-context';
import { BindingGroup } from './BindingGroup';
import { BindingCaptureModal } from '@features/hotkey-bindings/BindingCaptureModal';
import {
  actionLabel,
  bindingLabel,
  ownerLabel,
} from '@features/hotkey-bindings/binding-labels';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './BindingsSettings.module.scss';

export const BindingsSettings = observer(() => {
  const bindings = useBindingsStore();
  const bindingsUi = useBindingsUiStore();
  const deviceInput = useDeviceInputStore();
  const navigation = useMainNavigationStore();
  const { t } = useTranslation('main-app');

  const query = bindingsUi.search.trim().toLowerCase();

  // Search covers the binding text too, so "F9" finds whatever is on F9 without
  // the user having to remember what the action is called.
  const matches = (actionId: string): boolean => {
    if (query === '') return true;

    const action = bindings.registry.byId.get(actionId);

    if (!action) return false;

    if (actionLabel(action, bindings.registry, t).toLowerCase().includes(query))
      return true;

    return bindings.bindingsFor(actionId).some((binding) =>
      bindingLabel(
        binding,
        binding.kind === 'device'
          ? deviceInput.deviceById(binding.deviceId)
          : undefined,
        t
      )
        .toLowerCase()
        .includes(query)
    );
  };

  const filteredWidget = navigation.hotkeysWidget;

  const shownOwners =
    filteredWidget === null
      ? bindings.registry.owners
      : bindings.registry.owners.filter((owner) => owner === filteredWidget);

  const groups = shownOwners
    .map((owner) => ({
      owner,
      actionIds: bindings.registry.actions
        .filter((action) => action.owner === owner && matches(action.id))
        .map((action) => action.id),
    }))
    .filter((group) => group.actionIds.length > 0);

  return (
    <>
      <SettingsCard
        title={t('bindings.title')}
        extra={
          <Popconfirm
            title={t('bindings.resetConfirm')}
            onConfirm={() => bindings.resetToDefaults()}
          >
            <Button size="small" type="text" danger>
              {t('bindings.resetAll')}
            </Button>
          </Popconfirm>
        }
      >
        <div className={styles.intro}>{t('bindings.intro')}</div>

        {filteredWidget !== null && (
          <div className={styles.filterRow}>
            <span>
              {t('bindings.filteredTo', {
                widget: ownerLabel(filteredWidget, bindings.registry, t),
              })}
            </span>

            <Button
              size="small"
              type="link"
              onClick={() => navigation.showAllHotkeys()}
            >
              {t('bindings.showAll')}
            </Button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className={styles.empty}>
            {bindingsUi.searchIsFromKey
              ? t('bindings.keyIsFree', { key: bindingsUi.search })
              : t('bindings.noMatches')}
          </div>
        ) : (
          groups.map((group) => (
            <BindingGroup
              key={group.owner}
              owner={group.owner}
              actionIds={group.actionIds}
            />
          ))
        )}
      </SettingsCard>

      <BindingCaptureModal />
    </>
  );
});
