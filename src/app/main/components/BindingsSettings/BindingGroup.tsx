import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Tag, Tooltip } from 'antd';
import { ChevronDown } from 'lucide-react';
import { APP_OWNER } from '@store/hotkeys/binding-types';
import { widgetVisibilityActionId } from '@store/hotkeys/actions';
import {
  useBindingsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { BindingRow } from './BindingRow';
import { ownerLabel } from './binding-labels';
import styles from './BindingsSettings.module.scss';

interface BindingGroupProps {
  owner: string;
  actionIds: string[];
  isOpen: boolean;
  onToggle: () => void;
}

export const BindingGroup = observer(
  ({ owner, actionIds, isOpen, onToggle }: BindingGroupProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const bindings = useBindingsStore();
    const { t } = useTranslation('main-app');

    // Nothing a widget owns runs while it is out of the layout — not its keys
    // and not its background work — so the group says so rather than letting
    // the bindings look broken.
    const isInactive =
      owner !== APP_OWNER && !widgetSettings.isWidgetInActiveLayout(owner);

    const boundCount = actionIds.filter(
      (actionId) => bindings.bindingsFor(actionId).length > 0
    ).length;

    const visibilityActionId = widgetVisibilityActionId(owner);

    const pinnedActionId = actionIds.includes(visibilityActionId)
      ? visibilityActionId
      : null;

    const otherActionIds = actionIds.filter(
      (actionId) => actionId !== visibilityActionId
    );

    return (
      <div className={styles.group}>
        <button
          type="button"
          className={styles.groupHeader}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <ChevronDown
            size={14}
            className={isOpen ? styles.groupChevronOpen : styles.groupChevron}
          />

          <span className={styles.groupTitle}>{ownerLabel(owner, t)}</span>

          <span className={styles.groupCount}>
            {t('bindings.boundCount', {
              bound: boundCount,
              total: actionIds.length,
            })}
          </span>

          {isInactive && (
            <Tooltip title={t('bindings.notInLayoutTooltip')}>
              <Tag color="warning">{t('bindings.notInLayout')}</Tag>
            </Tooltip>
          )}
        </button>

        {isOpen && (
          <div className={styles.groupBody}>
            {/*
              Show/hide comes first and stands apart: it is the only binding
              that works when the widget is out of the layout, so it is the one
              to reach for when the rest are inert.
            */}
            {pinnedActionId && (
              <div className={styles.pinnedRow}>
                <BindingRow actionId={pinnedActionId} />
              </div>
            )}

            {otherActionIds.map((actionId) => (
              <BindingRow key={actionId} actionId={actionId} />
            ))}
          </div>
        )}
      </div>
    );
  }
);
