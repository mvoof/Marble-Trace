import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Modal, Popconfirm } from 'antd';
import {
  Plus,
  Play,
  Pencil,
  Trash2,
  Check,
  X,
  LayoutTemplate,
  Copy,
} from 'lucide-react';
import {
  useWidgetSettingsStore,
  useAppSettingsStore,
  useSimStore,
} from '@store/root-store-context';
import {
  resolveBackgroundSrc,
  deleteBackgroundImage,
} from '@utils/widget/layout-background';
import type { SavedLayout, SessionContext } from '@/types/widget-settings';
import { getWidgetLabel } from '@utils/widget-i18n';
import styles from './LayoutList.module.scss';

interface LayoutPreviewProps {
  layout: SavedLayout;
}

const LayoutPreview = observer(({ layout }: LayoutPreviewProps) => {
  const { t } = useTranslation('main-app');
  const [backgroundSrc, setBackgroundSrc] = useState<string | undefined>();

  useEffect(() => {
    let active = true;

    const loadBg = async () => {
      if (layout.backgroundImage) {
        try {
          const src = await resolveBackgroundSrc(layout.backgroundImage);

          if (active) {
            setBackgroundSrc(src);
          }
        } catch (error) {
          console.error('Failed to resolve background image:', error);
        }
      } else {
        if (active) {
          setBackgroundSrc(undefined);
        }
      }
    };

    void loadBg();

    return () => {
      active = false;
    };
  }, [layout.backgroundImage]);

  const monitorName =
    layout.activeMonitorName || Object.keys(layout.monitorConfigs)[0];

  const monitorConfig = monitorName
    ? layout.monitorConfigs[monitorName]
    : undefined;

  const resolution = monitorConfig?.resolution || { width: 1920, height: 1080 };
  const widgets = monitorConfig?.widgets || [];
  const enabledWidgets = widgets.filter(
    (widget) => widget.userSettings.enabled
  );

  return (
    <div className={styles.previewWrapper}>
      <div
        className={styles.previewContainer}
        style={{
          backgroundImage: backgroundSrc ? `url(${backgroundSrc})` : undefined,
        }}
      >
        {enabledWidgets.map((widget) => {
          const xPct = (widget.userSettings.x / resolution.width) * 100;
          const yPct = (widget.userSettings.y / resolution.height) * 100;
          const wPct =
            (widget.userSettings.currentWidth / resolution.width) * 100;
          const hPct =
            (widget.userSettings.currentHeight / resolution.height) * 100;

          return (
            <div
              key={widget.id}
              className={styles.previewWidget}
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                width: `${wPct}%`,
                height: `${hPct}%`,
              }}
            />
          );
        })}

        {enabledWidgets.length === 0 && (
          <div className={styles.emptyPreviewText}>
            {t('layoutList.emptyLayout')}
          </div>
        )}
      </div>
    </div>
  );
});

interface LayoutListProps {
  onOpenEditor: (id: string) => void;
}

const SESSION_LABEL_KEYS: Record<SessionContext, string> = {
  Practice: 'layoutList.sessions.practice',
  Qualify: 'layoutList.sessions.qualify',
  Race: 'layoutList.sessions.race',
  Garage: 'layoutList.sessions.garage',
};

export const LayoutList = observer(({ onOpenEditor }: LayoutListProps) => {
  const widgetSettings = useWidgetSettingsStore();
  const appSettings = useAppSettingsStore();
  const simStore = useSimStore();
  const { t, i18n } = useTranslation('main-app');
  const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;
  const isAutoSwitchActive = autoSwitchEnabled && simStore.isConnected;

  const [selectedId, setSelectedId] = useState<string | null>(
    widgetSettings.activeLayoutId
  );

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const selectedLayout = widgetSettings.layouts.find(
    (layout) => layout.id === selectedId
  );

  useEffect(() => {
    if (
      selectedId &&
      !widgetSettings.layouts.some((layout) => layout.id === selectedId)
    ) {
      setSelectedId(widgetSettings.activeLayoutId);
    }
  }, [selectedId, widgetSettings.layouts, widgetSettings.activeLayoutId]);

  const handleCreateLayout = () => {
    const name = newLayoutName.trim();

    if (!name) {
      return;
    }

    widgetSettings.saveLayout(name);
    setSelectedId(widgetSettings.activeLayoutId);
    setNewLayoutName('');
    setIsCreateModalOpen(false);
  };

  const handleRenameConfirm = () => {
    const name = renameValue.trim();

    if (selectedId && name) {
      widgetSettings.renameLayout(selectedId, name);
      setIsRenaming(false);
    }
  };

  const handleActivate = () => {
    if (selectedId) {
      widgetSettings.selectLayout(selectedId);
    }
  };

  const handleOpenEditor = () => {
    if (selectedId) {
      onOpenEditor(selectedId);
    }
  };

  const handleDeleteLayout = () => {
    if (selectedId) {
      const activeLayout = widgetSettings.layouts.find(
        (layout) => layout.id === selectedId
      );

      if (activeLayout?.backgroundImage) {
        void deleteBackgroundImage(activeLayout.backgroundImage);
      }

      widgetSettings.deleteLayout(selectedId);
    }
  };

  const handleDuplicateLayout = async () => {
    if (selectedId && !isDuplicating) {
      setIsDuplicating(true);

      try {
        const newId = await widgetSettings.cloneLayout(selectedId);

        if (newId) {
          setSelectedId(newId);
        }
      } finally {
        setIsDuplicating(false);
      }
    }
  };

  const selectedMonitorName = selectedLayout
    ? selectedLayout.activeMonitorName ||
      Object.keys(selectedLayout.monitorConfigs)[0]
    : undefined;

  const selectedMonitorConfig =
    selectedLayout && selectedMonitorName
      ? selectedLayout.monitorConfigs[selectedMonitorName]
      : undefined;

  const selectedResolution = selectedMonitorConfig?.resolution;
  const selectedWidgets = selectedMonitorConfig?.widgets || [];
  const selectedEnabledWidgets = selectedWidgets.filter(
    (w) => w.userSettings.enabled
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.moduleLabel}>
            {t('layoutList.moduleLabel')}
          </span>

          <h1 className={styles.title}>{t('layoutList.title')}</h1>
          <p className={styles.subtitle}>
            {autoSwitchEnabled
              ? t('layoutList.subtitleAutoSwitch')
              : t('layoutList.subtitleManual')}
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            className={`${styles.headerToggle} ${
              autoSwitchEnabled ? styles.headerToggleActive : ''
            }`}
            onClick={() => appSettings.setAutoSwitchLayouts(!autoSwitchEnabled)}
            title={t('layoutList.toggleAutoSwitchTooltip')}
          >
            {t('layoutList.autoSwitchLabel', {
              state: autoSwitchEnabled
                ? t('layoutList.on')
                : t('layoutList.off'),
            })}
          </Button>

          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setNewLayoutName('');
              setIsCreateModalOpen(true);
            }}
          >
            {t('layoutList.newLayout')}
          </Button>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.gridSection}>
          <div className={styles.layoutsGrid}>
            {widgetSettings.layouts.map((layout) => {
              const isSelected = layout.id === selectedId;
              const isActive = layout.id === widgetSettings.activeLayoutId;
              const assignedSessions = (
                ['Practice', 'Qualify', 'Race', 'Garage'] as SessionContext[]
              ).filter(
                (context) =>
                  widgetSettings.sessionLayouts?.[context] === layout.id
              );

              const monitorName =
                layout.activeMonitorName ||
                Object.keys(layout.monitorConfigs)[0];

              const monitorConfig = monitorName
                ? layout.monitorConfigs[monitorName]
                : undefined;

              const widgets = monitorConfig?.widgets || [];
              const enabledWidgetsCount = widgets.filter(
                (w) => w.userSettings.enabled
              ).length;

              return (
                <button
                  key={layout.id}
                  type="button"
                  className={`${styles.layoutCard} ${
                    isSelected ? styles.layoutCardSelected : ''
                  }`}
                  onClick={() => {
                    setSelectedId(layout.id);
                    setRenameValue(layout.name);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(layout.id);
                      setRenameValue(layout.name);
                    }
                  }}
                  onDoubleClick={() => {
                    setSelectedId(layout.id);
                    onOpenEditor(layout.id);
                  }}
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
                      {t('layoutList.widgetsCount', {
                        count: enabledWidgetsCount,
                      })}
                      {monitorConfig?.resolution
                        ? ` • ${monitorConfig.resolution.width}x${monitorConfig.resolution.height}`
                        : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className={styles.detailsPanel}>
          {selectedLayout ? (
            <>
              <div className={styles.detailsHeader}>
                {isRenaming ? (
                  <div className={styles.editNameWrapper}>
                    <Input
                      size="small"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
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
                    <span className={styles.detailsTitle}>
                      {selectedLayout.name}
                    </span>
                    <Button
                      size="small"
                      type="text"
                      icon={<Pencil size={14} />}
                      onClick={() => {
                        setRenameValue(selectedLayout.name);
                        setIsRenaming(true);
                      }}
                    />
                  </div>
                )}
                <span className={styles.detailsMeta}>
                  {t('layoutList.created')}{' '}
                  {new Date(selectedLayout.createdAt).toLocaleDateString(
                    i18n.language
                  )}
                </span>
              </div>

              <div className={styles.detailsInfoGroup}>
                <div className={styles.assignmentSection}>
                  <span className={styles.sectionLabel}>
                    {t('layoutList.autoSwitchAssignment')}
                  </span>
                  <div className={styles.assignmentGrid}>
                    {(
                      [
                        'Practice',
                        'Qualify',
                        'Race',
                        'Garage',
                      ] as SessionContext[]
                    ).map((context) => {
                      const isAssigned =
                        widgetSettings.sessionLayouts?.[context] ===
                        selectedLayout.id;
                      return (
                        <Checkbox
                          key={context}
                          checked={isAssigned}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            widgetSettings.setSessionLayout(
                              context,
                              checked ? selectedLayout.id : null
                            );
                          }}
                        >
                          {t(SESSION_LABEL_KEYS[context])}
                        </Checkbox>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    {t('layoutList.activeMonitor')}
                  </span>
                  <span className={styles.infoValue}>
                    {selectedMonitorName || t('layoutList.none')}
                  </span>
                </div>
                {selectedResolution && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>
                      {t('layoutList.resolution')}
                    </span>
                    <span className={styles.infoValue}>
                      {selectedResolution.width}×{selectedResolution.height}
                    </span>
                  </div>
                )}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    {t('layoutList.activeWidgets')}
                  </span>
                  <span className={styles.infoValue}>
                    {selectedEnabledWidgets.length}
                  </span>
                </div>

                {selectedEnabledWidgets.length > 0 && (
                  <div className={styles.widgetsList}>
                    {selectedEnabledWidgets.map((widget) => (
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
                  onClick={handleActivate}
                  disabled={
                    selectedId === widgetSettings.activeLayoutId ||
                    isAutoSwitchActive
                  }
                  title={
                    isAutoSwitchActive
                      ? t('layoutList.activateDisabledAutoSwitch')
                      : undefined
                  }
                  style={{ width: '100%' }}
                >
                  {t('layoutList.activateLayout')}
                </Button>

                <Button
                  icon={<LayoutTemplate size={16} />}
                  onClick={handleOpenEditor}
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
                  onConfirm={handleDeleteLayout}
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
            </>
          ) : (
            <div className={styles.detailsEmpty}>
              <LayoutTemplate size={32} />
              <p>{t('layoutList.emptySelection')}</p>
            </div>
          )}
        </aside>
      </div>

      <Modal
        title={t('layoutList.createNewLayout')}
        open={isCreateModalOpen}
        onOk={handleCreateLayout}
        onCancel={() => setIsCreateModalOpen(false)}
        okText={t('layoutEditor.create')}
        cancelText={t('layoutEditor.cancel')}
      >
        <Input
          placeholder={t('layoutList.enterLayoutName')}
          value={newLayoutName}
          onChange={(event) => setNewLayoutName(event.target.value)}
          onPressEnter={handleCreateLayout}
          style={{ marginTop: '12px' }}
        />
      </Modal>
    </div>
  );
});
