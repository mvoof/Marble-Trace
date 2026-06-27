import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Input, Modal, Popconfirm } from 'antd';
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
import { useWidgetSettingsStore } from '@store/root-store-context';
import {
  resolveBackgroundSrc,
  deleteBackgroundImage,
} from '@utils/widget/layout-background';
import type { SavedLayout } from '@/types/widget-settings';
import styles from './LayoutList.module.scss';

interface LayoutPreviewProps {
  layout: SavedLayout;
}

const LayoutPreview = observer(({ layout }: LayoutPreviewProps) => {
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
          <div className={styles.emptyPreviewText}>Empty Layout</div>
        )}
      </div>
    </div>
  );
});

interface LayoutListProps {
  onOpenEditor: () => void;
}

export const LayoutList = observer(({ onOpenEditor }: LayoutListProps) => {
  const widgetSettings = useWidgetSettingsStore();

  const [selectedId, setSelectedId] = useState<string | null>(
    widgetSettings.activeLayoutId
  );

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
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
      widgetSettings.selectLayout(selectedId);
      onOpenEditor();
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
    if (selectedId) {
      await widgetSettings.cloneLayout(selectedId);
      setSelectedId(widgetSettings.activeLayoutId);
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
          <h2 className={styles.title}>Layouts</h2>
          <p className={styles.subtitle}>
            Select, activate, or open layouts in the editor. Double-click a card
            to edit.
          </p>
        </div>

        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setNewLayoutName('');
            setIsCreateModalOpen(true);
          }}
        >
          New Layout
        </Button>
      </header>

      <div className={styles.content}>
        <div className={styles.gridSection}>
          <div className={styles.layoutsGrid}>
            {widgetSettings.layouts.map((layout) => {
              const isSelected = layout.id === selectedId;
              const isActive = layout.id === widgetSettings.activeLayoutId;

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
                  } ${isActive ? styles.layoutCardActive : ''}`}
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
                    widgetSettings.selectLayout(layout.id);
                    onOpenEditor();
                  }}
                >
                  <LayoutPreview layout={layout} />

                  <div className={styles.cardFooter}>
                    <div className={styles.cardHeaderRow}>
                      <span className={styles.cardName}>{layout.name}</span>
                      {isActive && (
                        <span className={styles.activeBadge}>Active</span>
                      )}
                    </div>
                    <span className={styles.cardMeta}>
                      {enabledWidgetsCount} widget
                      {enabledWidgetsCount !== 1 ? 's' : ''}
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
                  Created:{' '}
                  {new Date(selectedLayout.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className={styles.detailsInfoGroup}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Active Monitor</span>
                  <span className={styles.infoValue}>
                    {selectedMonitorName || 'None'}
                  </span>
                </div>
                {selectedResolution && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Resolution</span>
                    <span className={styles.infoValue}>
                      {selectedResolution.width}×{selectedResolution.height}
                    </span>
                  </div>
                )}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Active Widgets</span>
                  <span className={styles.infoValue}>
                    {selectedEnabledWidgets.length}
                  </span>
                </div>

                {selectedEnabledWidgets.length > 0 && (
                  <div className={styles.widgetsList}>
                    {selectedEnabledWidgets.map((widget) => (
                      <div key={widget.id} className={styles.widgetItem}>
                        <span className={styles.widgetActiveLabel}>
                          {widget.label}
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
                  disabled={selectedId === widgetSettings.activeLayoutId}
                  style={{ width: '100%' }}
                >
                  Activate Layout
                </Button>

                <Button
                  icon={<LayoutTemplate size={16} />}
                  onClick={handleOpenEditor}
                  style={{ width: '100%' }}
                >
                  Open Editor
                </Button>

                <Button
                  icon={<Copy size={16} />}
                  onClick={handleDuplicateLayout}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  Duplicate Layout
                </Button>

                <Popconfirm
                  title="Delete this layout?"
                  description="This action cannot be undone."
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  cancelText="Cancel"
                  onConfirm={handleDeleteLayout}
                >
                  <Button
                    danger
                    type="text"
                    icon={<Trash2 size={16} />}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    Delete Layout
                  </Button>
                </Popconfirm>
              </div>
            </>
          ) : (
            <div className={styles.detailsEmpty}>
              <LayoutTemplate size={32} />
              <p>Select a layout to see details and actions</p>
            </div>
          )}
        </aside>
      </div>

      <Modal
        title="Create New Layout"
        open={isCreateModalOpen}
        onOk={handleCreateLayout}
        onCancel={() => setIsCreateModalOpen(false)}
        okText="Create"
        cancelText="Cancel"
      >
        <Input
          placeholder="Enter layout name..."
          value={newLayoutName}
          onChange={(event) => setNewLayoutName(event.target.value)}
          onPressEnter={handleCreateLayout}
          style={{ marginTop: '12px' }}
        />
      </Modal>
    </div>
  );
});
