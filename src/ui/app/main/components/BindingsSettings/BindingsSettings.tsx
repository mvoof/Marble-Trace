import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm } from 'antd';
import {
  useBindingsStore,
  useBindingsUiStore,
  useDeviceInputStore,
} from '@store/root-store-context';
import { BindingGroup } from './BindingGroup';
import { BindingSearch } from './BindingSearch';
import { BindingCaptureModal } from './BindingCaptureModal';
import { actionLabel, bindingLabel } from './binding-labels';
import styles from './BindingsSettings.module.scss';

export const BindingsSettings = observer(() => {
  const bindings = useBindingsStore();
  const bindingsUi = useBindingsUiStore();
  const deviceInput = useDeviceInputStore();
  const { t } = useTranslation('main-app');

  // Every group starts open: the whole list is short enough to scan, and
  // hunting for which accordion hides a key is worse than scrolling past it.
  const [collapsedOwners, setCollapsedOwners] = useState<string[]>([]);

  const toggleOwner = (owner: string) => {
    setCollapsedOwners((collapsed) =>
      collapsed.includes(owner)
        ? collapsed.filter((candidate) => candidate !== owner)
        : [...collapsed, owner]
    );
  };

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

  const groups = bindings.registry.owners
    .map((owner) => ({
      owner,
      actionIds: bindings.registry.actions
        .filter((action) => action.owner === owner && matches(action.id))
        .map((action) => action.id),
    }))
    .filter((group) => group.actionIds.length > 0);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardContent}>
          <div className={styles.intro}>{t('bindings.intro')}</div>

          <div className={styles.toolbar}>
            <BindingSearch />

            <Popconfirm
              title={t('bindings.resetConfirm')}
              onConfirm={() => bindings.resetToDefaults()}
            >
              <Button size="small" danger>
                {t('bindings.resetAll')}
              </Button>
            </Popconfirm>
          </div>

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
                // A search is a request to see the matches, so it wins over a
                // group the user collapsed earlier.
                isOpen={query !== '' || !collapsedOwners.includes(group.owner)}
                onToggle={() => toggleOwner(group.owner)}
              />
            ))
          )}
        </div>
      </div>

      <BindingCaptureModal />
    </>
  );
});
