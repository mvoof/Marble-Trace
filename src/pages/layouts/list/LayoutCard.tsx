import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Modal, Popconfirm } from 'antd';
import { Copy, Download, Pencil, Play, Trash2, Type } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { useLayoutGestureStores } from '@features/layout-editor/layout-editor-context';
import { deleteLayoutAndBackgrounds } from '@features/layout-editor/layout-gestures';
import { useLayoutFilesStore } from '@features/layout-files/layout-files-context';
import type { SavedLayout } from '@shared/contracts/widget-settings';
import { cx } from '@shared/lib/class-names';

import { LayoutPreview } from './LayoutPreview';
import { SESSION_CONTEXTS, SESSION_LOOKS } from './session-labels';
import styles from './LayoutCard.module.scss';

interface LayoutCardProps {
  layout: SavedLayout;
  onOpenEditor: () => void;
}

/**
 * One layout: its miniature, name, what it holds and the situations it is
 * auto-switched to (shown, never edited here — that is the Auto-switch
 * block's), with what can be done to it along the bottom.
 */
export const LayoutCard = observer(
  ({ layout, onOpenEditor }: LayoutCardProps) => {
    const layouts = useLayoutsStore();
    const liveWidgets = useMainLiveWidgetsStore();
    const gestureStores = useLayoutGestureStores();
    const layoutFiles = useLayoutFilesStore();
    const appSettings = useAppSettingsStore();
    const { t } = useTranslation('main-app');
    const { message } = App.useApp();

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isDuplicating, setIsDuplicating] = useState(false);

    const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;
    const isOnScreen = layout.id === layouts.liveLayoutId;
    const assignedSessions = SESSION_CONTEXTS.filter(
      (context) => layouts.sessionLayouts[context] === layout.id
    );
    const monitorCount = layout.monitors.length;
    const enabledWidgetsCount = layout.widgets.filter(
      (widget) => widget.userSettings.enabled
    ).length;

    const handleRenameConfirm = () => {
      const name = renameValue.trim();

      if (!name) {
        return;
      }

      layouts.renameLayout(layout.id, name);
      setIsRenaming(false);
    };

    const handleDuplicate = async () => {
      if (isDuplicating) {
        return;
      }

      setIsDuplicating(true);

      try {
        await layouts.cloneLayout(layout.id);
      } finally {
        setIsDuplicating(false);
      }
    };

    const handleExport = async () => {
      try {
        const path = await layoutFiles.exportLayout(layout.id);

        if (path) {
          void message.success(t('layoutList.exported', { path }));
        }
      } catch {
        void message.error(t('layoutList.exportFailed'));
      }
    };

    return (
      <article className={cx(styles.card, isOnScreen && styles.cardOnScreen)}>
        <button
          type="button"
          className={styles.openArea}
          onClick={onOpenEditor}
          title={t('layoutList.open')}
        >
          <LayoutPreview layout={layout} />

          <span className={styles.nameRow}>
            <span className={styles.name}>{layout.name}</span>

            {isOnScreen && (
              <span className={styles.onScreenChip}>
                {t('layoutList.onScreen')}
              </span>
            )}
          </span>

          <span className={styles.meta}>
            {monitorCount > 0
              ? t('layoutList.monitorsCount', { count: monitorCount })
              : t('layoutList.noMonitors')}
            {' · '}
            {t('layoutList.widgetsCount', { count: enabledWidgetsCount })}
          </span>

          <span className={styles.chips}>
            {assignedSessions.length > 0 ? (
              assignedSessions.map((session) => (
                <span
                  key={session}
                  className={cx(
                    styles.chip,
                    !autoSwitchEnabled && styles.chipOff
                  )}
                >
                  {t(SESSION_LOOKS[session].labelKey)}
                </span>
              ))
            ) : (
              <span className={styles.notAssigned}>
                {t('layoutList.notAutoSwitched')}
              </span>
            )}
          </span>
        </button>

        <footer className={styles.actions}>
          <Button
            size="small"
            type="text"
            icon={<Pencil size={14} />}
            onClick={onOpenEditor}
          >
            {t('layoutList.open')}
          </Button>

          {!autoSwitchEnabled && !isOnScreen && (
            <Button
              size="small"
              type="text"
              icon={<Play size={14} />}
              title={t('layoutList.putOnScreen')}
              aria-label={t('layoutList.putOnScreen')}
              onClick={() => liveWidgets.selectLayout(layout.id)}
            />
          )}

          <Button
            size="small"
            type="text"
            icon={<Copy size={14} />}
            title={t('layoutList.duplicate')}
            aria-label={t('layoutList.duplicate')}
            loading={isDuplicating}
            onClick={handleDuplicate}
          />

          <Button
            size="small"
            type="text"
            icon={<Type size={14} />}
            title={t('layoutList.rename')}
            aria-label={t('layoutList.rename')}
            onClick={() => {
              setRenameValue(layout.name);
              setIsRenaming(true);
            }}
          />

          <Button
            size="small"
            type="text"
            icon={<Download size={14} />}
            title={t('layoutList.export')}
            aria-label={t('layoutList.export')}
            loading={layoutFiles.exportingId === layout.id}
            onClick={() => void handleExport()}
          />

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
              className={styles.deleteButton}
              size="small"
              type="text"
              danger
              icon={<Trash2 size={14} />}
              title={t('layoutList.delete')}
              aria-label={t('layoutList.delete')}
            />
          </Popconfirm>
        </footer>

        <Modal
          title={t('layoutList.rename')}
          open={isRenaming}
          onOk={handleRenameConfirm}
          onCancel={() => setIsRenaming(false)}
          okText={t('layoutList.rename')}
          cancelText={t('layoutEditor.cancel')}
          destroyOnHidden
        >
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onPressEnter={handleRenameConfirm}
          />
        </Modal>
      </article>
    );
  }
);
