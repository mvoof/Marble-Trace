import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useSimStore } from '@entities/sim/sim-context';
import type { SavedLayout } from '@shared/contracts/widget-settings';

import { LayoutPreview } from './LayoutPreview';
import { SESSION_CONTEXTS, SESSION_LABEL_KEYS } from './session-labels';
import styles from './LayoutCard.module.scss';

interface LayoutCardProps {
  layout: SavedLayout;
  isSelected: boolean;
  onSelect: () => void;
  onOpenEditor: () => void;
}

/**
 * One layout in the list: its preview, its name, the sessions it is assigned
 * to and how much it holds. A click selects it, a double click opens it.
 */
export const LayoutCard = observer(
  ({ layout, isSelected, onSelect, onOpenEditor }: LayoutCardProps) => {
    const layouts = useLayoutsStore();
    const appSettings = useAppSettingsStore();
    const simStore = useSimStore();
    const { t } = useTranslation('main-app');

    const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;
    const isAutoSwitchActive = autoSwitchEnabled && simStore.isConnected;
    const isActive = layout.id === layouts.editingLayoutId;
    const assignedSessions = SESSION_CONTEXTS.filter(
      (context) => layouts.sessionLayouts?.[context] === layout.id
    );
    const monitorCount = layout.monitors.length;
    const enabledWidgetsCount = layout.widgets.filter(
      (widget) => widget.userSettings.enabled
    ).length;

    return (
      <button
        type="button"
        className={`${styles.layoutCard} ${
          isSelected ? styles.layoutCardSelected : ''
        }`}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        onDoubleClick={onOpenEditor}
      >
        <LayoutPreview layout={layout} />

        <div className={styles.cardFooter}>
          <div className={styles.cardHeaderRow}>
            <span className={styles.cardName}>{layout.name}</span>
            {isActive && !isAutoSwitchActive && (
              <span className={styles.activeBadge}>
                {t('layoutList.active')}
              </span>
            )}
          </div>

          <div className={styles.badgesWrapper}>
            {assignedSessions.length > 0 ? (
              assignedSessions.map((session) => (
                <span
                  key={session}
                  className={`${styles.sessionBadge} ${
                    autoSwitchEnabled
                      ? styles[`sessionBadge${session}`]
                      : styles.sessionBadgeDisabled
                  }`}
                  title={t('layoutList.assignedTo', {
                    session: t(SESSION_LABEL_KEYS[session]),
                  })}
                >
                  {t(SESSION_LABEL_KEYS[session])}
                </span>
              ))
            ) : (
              <span
                className={`${styles.sessionBadge} ${styles.sessionBadgeManual}`}
                title={t('layoutList.manualActivationOnly')}
              >
                {t('layoutList.manual')}
              </span>
            )}
          </div>

          <span className={styles.cardMeta}>
            {monitorCount > 0
              ? t('layoutList.monitorsCount', { count: monitorCount })
              : t('layoutList.noMonitors')}
            {' • '}
            {t('layoutList.widgetsCount', { count: enabledWidgetsCount })}
          </span>
        </div>
      </button>
    );
  }
);
