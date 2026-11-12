import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Popconfirm } from 'antd';
import {
  Check,
  Copy,
  LayoutTemplate,
  Pencil,
  Play,
  Trash2,
  X,
} from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { widgetsOnMonitor } from '@entities/layout/virtual-desktop';
import { getWidgetLabel } from '@entities/widget/widget-i18n';
import { useLayoutGestureStores } from '@features/layout-editor/layout-editor-context';
import { deleteLayoutAndBackgrounds } from '@features/layout-editor/layout-gestures';
import type { SavedLayout } from '@shared/contracts/widget-settings';

import { LayoutMonitorRow } from './LayoutMonitorRow';
import { SESSION_CONTEXTS, SESSION_LABEL_KEYS } from './session-labels';
import styles from './LayoutDetails.module.scss';

interface LayoutDetailsProps {
  layout: SavedLayout | undefined;
  /** The name being typed — reset by the list each time a card is picked. */
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onSelect: (id: string) => void;
  onOpenEditor: (id: string) => void;
}

/**
 * The selected layout, in the column beside the list: its name, the sessions
 * it is assigned to, its screens and widgets, and what can be done with it.
 */
export const LayoutDetails = observer(
  ({
    layout,
    renameValue,
    onRenameValueChange,
    onSelect,
    onOpenEditor,
  }: LayoutDetailsProps) => {
    const liveWidgets = useMainLiveWidgetsStore();
    const layouts = useLayoutsStore();
    const gestureStores = useLayoutGestureStores();
    const appSettings = useAppSettingsStore();
    const { t, i18n } = useTranslation('main-app');
    const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;

    const [isRenaming, setIsRenaming] = useState(false);
    const [isDuplicating, setIsDuplicating] = useState(false);

    if (!layout) {
      return (
        <aside className={styles.detailsPanel}>
          <div className={styles.detailsEmpty}>
            <LayoutTemplate size={32} />
            <p>{t('layoutList.emptySelection')}</p>
          </div>
        </aside>
      );
    }

    const handleRenameConfirm = () => {
      const name = renameValue.trim();

      if (name) {
        layouts.renameLayout(layout.id, name);
        setIsRenaming(false);
      }
    };

    const handleDuplicateLayout = async () => {
      if (isDuplicating) {
        return;
      }

      setIsDuplicating(true);

      try {
        const newId = await layouts.cloneLayout(layout.id);

        if (newId) {
          onSelect(newId);
        }
      } finally {
        setIsDuplicating(false);
      }
    };

    const enabledWidgets = layout.widgets.filter(
      (widget) => widget.userSettings.enabled
    );

    return (
      <aside className={styles.detailsPanel}>
        <div className={styles.detailsHeader}>
          {isRenaming ? (
            <div className={styles.editNameWrapper}>
              <Input
                size="small"
                value={renameValue}
                onChange={(event) => onRenameValueChange(event.target.value)}
                onPressEnter={handleRenameConfirm}
                className={styles.editNameInput}
              />
              <Button
                size="small"
                type="text"
                icon={<Check size={14} />}
                onClick={handleRenameConfirm}
              />
              <Button
                size="small"
                type="text"
                icon={<X size={14} />}
                onClick={() => setIsRenaming(false)}
              />
            </div>
          ) : (
            <div className={styles.cardHeaderRow}>
              <span className={styles.detailsTitle}>{layout.name}</span>
              <Button
                size="small"
                type="text"
                icon={<Pencil size={14} />}
                onClick={() => {
                  onRenameValueChange(layout.name);
                  setIsRenaming(true);
                }}
              />
            </div>
          )}
          <span className={styles.detailsMeta}>
            {t('layoutList.created')}{' '}
            {new Date(layout.createdAt).toLocaleDateString(i18n.language)}
          </span>
        </div>

        <div className={styles.detailsInfoGroup}>
          <div className={styles.assignmentSection}>
            <span className={styles.sectionLabel}>
              {t('layoutList.autoSwitchAssignment')}
            </span>
            <div className={styles.assignmentGrid}>
              {SESSION_CONTEXTS.map((context) => (
                <Checkbox
                  key={context}
                  checked={layouts.sessionLayouts?.[context] === layout.id}
                  onChange={(event) =>
                    layouts.setSessionLayout(
                      context,
                      event.target.checked ? layout.id : null
                    )
                  }
                >
                  {t(SESSION_LABEL_KEYS[context])}
                </Checkbox>
              ))}
            </div>
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('layoutList.monitors')}</span>
            <span className={styles.infoValue}>{layout.monitors.length}</span>
          </div>

          <div className={styles.monitorList}>
            {layout.monitors.length === 0 ? (
              <div className={styles.monitorEmpty}>
                {t('layoutList.noMonitors')}
              </div>
            ) : (
              layout.monitors.map((monitor) => (
                <LayoutMonitorRow
                  key={monitor.name}
                  layoutId={layout.id}
                  monitor={monitor}
                  widgetCount={
                    widgetsOnMonitor(enabledWidgets, monitor.name).length
                  }
                />
              ))
            )}
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>
              {t('layoutList.totalWidgets')}
            </span>
            <span className={styles.infoValue}>{enabledWidgets.length}</span>
          </div>

          {enabledWidgets.length > 0 && (
            <div className={styles.widgetsList}>
              {enabledWidgets.map((widget) => (
                <div key={widget.id} className={styles.widgetItem}>
                  <span className={styles.widgetActiveLabel}>
                    {getWidgetLabel(t, widget)}
                  </span>
                  <span className={styles.infoValue}>
                    {widget.userSettings.x},{widget.userSettings.y}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.detailsActions}>
          <Button
            type="primary"
            icon={<Play size={16} />}
            onClick={() => liveWidgets.selectLayout(layout.id)}
            disabled={
              layout.id === layouts.editingLayoutId || autoSwitchEnabled
            }
            title={
              autoSwitchEnabled
                ? t('layoutList.activateDisabledAutoSwitch')
                : undefined
            }
            style={{ width: '100%' }}
          >
            {t('layoutList.activateLayout')}
          </Button>

          <Button
            icon={<LayoutTemplate size={16} />}
            onClick={() => onOpenEditor(layout.id)}
            style={{ width: '100%' }}
          >
            {t('layoutList.openEditor')}
          </Button>

          <Button
            icon={<Copy size={16} />}
            onClick={handleDuplicateLayout}
            loading={isDuplicating}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {t('layoutList.duplicateLayout')}
          </Button>

          <Popconfirm
            title={t('layoutList.deleteLayoutConfirmTitle')}
            description={t('layoutList.deleteLayoutConfirmDescription')}
            okText={t('layoutEditor.delete')}
            okButtonProps={{ danger: true }}
            cancelText={t('layoutEditor.cancel')}
            onConfirm={() =>
              deleteLayoutAndBackgrounds(gestureStores, layout.id)
            }
          >
            <Button
              danger
              type="text"
              icon={<Trash2 size={16} />}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {t('layoutList.deleteLayout')}
            </Button>
          </Popconfirm>
        </div>
      </aside>
    );
  }
);
