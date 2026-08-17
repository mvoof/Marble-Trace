import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Modal, Popconfirm, Segmented } from 'antd';
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
  useRemoteDevicesStore,
  useSimStore,
} from '@store/root-store-context';
import { isRemoteMonitor } from '@utils/remote-screen';
import {
  resolveBackgroundSrc,
  deleteBackgroundImage,
} from '@store/settings/layout-background';
import { listOverlayMonitors } from '@platform/sync/overlay-resolution';
import {
  monitorsBounds,
  widgetsOnMonitor,
} from '@store/settings/virtual-desktop';
import type { SavedLayout, SessionContext } from '@/types/widget-settings';
import { getWidgetLabel } from '@ui/app/widget-i18n';
import styles from './LayoutList.module.scss';

interface LayoutPreviewProps {
  layout: SavedLayout;
}
const PREVIEW_ASPECT = 16 / 9;

const percentOf = (value: number, origin: number, span: number) =>
  `${((value - origin) / span) * 100}%`;

const LayoutPreview = observer(({ layout }: LayoutPreviewProps) => {
  const { t } = useTranslation('main-app');
  const [backgrounds, setBackgrounds] = useState<Record<string, string>>({});

  const images = layout.backgroundImages;

  useEffect(() => {
    let active = true;

    const loadBackgrounds = async () => {
      const entries = await Promise.all(
        Object.entries(images ?? {}).map(async ([monitorName, image]) => {
          try {
            return [monitorName, await resolveBackgroundSrc(image)] as const;
          } catch (error) {
            console.error('Failed to resolve background image:', error);

            return null;
          }
        })
      );

      if (!active) return;

      setBackgrounds(
        Object.fromEntries(
          entries.filter((entry): entry is [string, string] => entry !== null)
        )
      );
    };

    void loadBackgrounds();

    return () => {
      active = false;
    };
  }, [images]);

  const desktop = monitorsBounds(layout.monitors);
  const enabledWidgets = layout.widgets.filter(
    (widget) => widget.userSettings.enabled
  );

  // The card is a fixed 16:9 box, but a multi-monitor desktop is any shape at
  // all, so the arrangement is letterboxed inside it rather than stretched.
  const desktopAspect = desktop.width / desktop.height;
  const fitsWidth = desktopAspect >= PREVIEW_ASPECT;

  const stageStyle = {
    width: fitsWidth ? '100%' : `${(desktopAspect / PREVIEW_ASPECT) * 100}%`,
    height: fitsWidth ? `${(PREVIEW_ASPECT / desktopAspect) * 100}%` : '100%',
  };

  return (
    <div className={styles.previewWrapper}>
      <div className={styles.previewStage} style={stageStyle}>
        {layout.monitors.map((monitor) => {
          const background = backgrounds[monitor.name];

          return (
            <div
              key={monitor.name}
              className={styles.previewMonitor}
              style={{
                left: percentOf(monitor.bounds.x, desktop.x, desktop.width),
                top: percentOf(monitor.bounds.y, desktop.y, desktop.height),
                width: percentOf(monitor.bounds.width, 0, desktop.width),
                height: percentOf(monitor.bounds.height, 0, desktop.height),
                backgroundImage: background ? `url(${background})` : undefined,
              }}
            />
          );
        })}

        {enabledWidgets.map((widget) => (
          <div
            key={widget.id}
            className={styles.previewWidget}
            style={{
              left: percentOf(widget.userSettings.x, desktop.x, desktop.width),
              top: percentOf(widget.userSettings.y, desktop.y, desktop.height),
              width: percentOf(
                widget.userSettings.currentWidth,
                0,
                desktop.width
              ),
              height: percentOf(
                widget.userSettings.currentHeight,
                0,
                desktop.height
              ),
            }}
          />
        ))}

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
  const remoteDevices = useRemoteDevicesStore();
  const appSettings = useAppSettingsStore();
  const simStore = useSimStore();
  const { t, i18n } = useTranslation('main-app');
  const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;
  const isAutoSwitchActive = autoSwitchEnabled && simStore.isConnected;

  const [selectedId, setSelectedId] = useState<string | null>(
    widgetSettings.activeLayoutId
  );

  // Monitors physically attached right now. A layout can hold configs for
  // screens that are currently unplugged — those keep their widgets but get no
  // overlay window, and are shown greyed out.
  const [onlineMonitorNames, setOnlineMonitorNames] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    let active = true;

    listOverlayMonitors()
      .then((monitors) => {
        if (active) {
          setOnlineMonitorNames(
            new Set(monitors.map((monitor) => monitor.name))
          );
        }
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, []);

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

      for (const image of Object.values(activeLayout?.backgroundImages ?? {})) {
        void deleteBackgroundImage(image);
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

  const selectedMonitors = selectedLayout?.monitors ?? [];

  const selectedEnabledWidgets = (selectedLayout?.widgets ?? []).filter(
    (widget) => widget.userSettings.enabled
  );

  const widgetCountOnMonitor = (monitorName: string) =>
    selectedLayout
      ? widgetsOnMonitor(
          selectedEnabledWidgets,
          monitorName,
          selectedLayout.monitors
        ).length
      : 0;

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
          <Segmented
            className={styles.modeSwitch}
            value={autoSwitchEnabled ? 'auto' : 'manual'}
            onChange={(value) =>
              appSettings.setAutoSwitchLayouts(value === 'auto')
            }
            options={[
              { label: t('layoutList.modeManual'), value: 'manual' },
              { label: t('layoutList.modeAuto'), value: 'auto' },
            ]}
            title={t('layoutList.toggleAutoSwitchTooltip')}
          />

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

              const monitorNames = layout.monitors.map(
                (monitor) => monitor.name
              );
              const enabledWidgetsCount = layout.widgets.filter(
                (widget) => widget.userSettings.enabled
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
                      {monitorNames.length > 0
                        ? t('layoutList.monitorsCount', {
                            count: monitorNames.length,
                          })
                        : t('layoutList.noMonitors')}
                      {' • '}
                      {t('layoutList.widgetsCount', {
                        count: enabledWidgetsCount,
                      })}
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
                    {t('layoutList.monitors')}
                  </span>
                  <span className={styles.infoValue}>
                    {selectedMonitors.length}
                  </span>
                </div>

                <div className={styles.monitorList}>
                  {selectedMonitors.length === 0 ? (
                    <div className={styles.monitorEmpty}>
                      {t('layoutList.noMonitors')}
                    </div>
                  ) : (
                    selectedMonitors.map((monitor) => {
                      const { name: monitorName, bounds } = monitor;
                      const widgetCount = widgetCountOnMonitor(monitorName);

                      // A remote screen has no display behind it, so "attached"
                      // means nothing for it: what it can be is a device that
                      // has the page open. Its size is chosen rather than
                      // detected, so it is always known and always shown.
                      const isRemote = isRemoteMonitor(monitor);

                      const device = isRemote
                        ? remoteDevices.bySlug(monitor.slug ?? '')
                        : undefined;

                      const isOnline = isRemote
                        ? device?.connected === true
                        : onlineMonitorNames.has(monitorName);

                      const meta = isRemote
                        ? `${bounds.width}×${bounds.height}${
                            isOnline
                              ? ''
                              : ` · ${t('layoutList.remoteNoDevice')}`
                          }`
                        : isOnline
                          ? `${bounds.width}×${bounds.height}`
                          : t('layoutList.monitorOffline');

                      return (
                        <div
                          key={monitorName}
                          className={`${styles.monitorRow} ${
                            isOnline ? '' : styles.monitorRowOffline
                          }`}
                        >
                          <span
                            className={`${styles.monitorDot} ${
                              isOnline ? '' : styles.monitorDotOffline
                            }`}
                          />
                          <span className={styles.monitorName}>
                            {monitorName}
                          </span>
                          <span className={styles.monitorMeta}>
                            {meta}
                            {` · ${widgetCount}`}
                          </span>
                          <Popconfirm
                            title={t('layoutList.removeMonitor')}
                            okText={t('layoutEditor.delete')}
                            okButtonProps={{ danger: true }}
                            cancelText={t('layoutEditor.cancel')}
                            onConfirm={() =>
                              widgetSettings.removeMonitor(
                                selectedLayout.id,
                                monitorName
                              )
                            }
                          >
                            <Button
                              size="small"
                              type="text"
                              icon={<X size={12} />}
                              title={t('layoutList.removeMonitor')}
                            />
                          </Popconfirm>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    {t('layoutList.totalWidgets')}
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
                    autoSwitchEnabled
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
