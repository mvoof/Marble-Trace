import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Button,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Tooltip,
  Modal,
  Popover,
  ConfigProvider,
} from 'antd';
import type { InputRef } from 'antd';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Image,
  ImageOff,
  Grid3x3,
  Magnet,
  Maximize,
  Minimize,
  Monitor,
  PanelLeft,
  PanelLeftClose,
  Lock,
  Unlock,
  BringToFront,
  SendToBack,
  Undo2,
  Redo2,
  ArrowUpLeft,
  ArrowUp,
  ArrowUpRight,
  Maximize2,
  ArrowRight,
  ArrowDownLeft,
  ArrowDown,
  ArrowDownRight,
  LayoutGrid,
} from 'lucide-react';
import {
  useAppSettingsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import {
  listOverlayMonitors,
  type OverlayMonitor,
} from '@store/sync/overlay-resolution';
import { LayoutCanvas } from './LayoutCanvas';
import { LayoutWidgetPanel } from './LayoutWidgetPanel';
import { LayoutList } from './LayoutList';
import {
  saveBackgroundImage,
  deleteBackgroundImage,
} from '@utils/widget/layout-background';
import styles from './LayoutEditor.module.scss';

type SnapPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'midLeft'
  | 'center'
  | 'midRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

const SCENARIO_OPTIONS = PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

const GRID_SIZE_OPTIONS = [10, 15, 20, 30, 40].map((size) => ({
  value: size,
  label: `${size}px`,
}));

// Layout editor section: a WYSIWYG canvas of the active layout plus a
// master-detail widget panel. Editing the canvas (drag/resize) or a widget's
// settings auto-commits into the active layout via the store's change reaction.
export const LayoutEditor = observer(
  ({
    mode = 'list',
    onModeChange,
  }: {
    mode?: 'list' | 'editor';
    onModeChange?: (mode: 'list' | 'editor') => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const appSettings = useAppSettingsStore();

    const [localMode, setLocalMode] = useState<'list' | 'editor'>('list');

    const activeMode = onModeChange ? mode : localMode;

    const handleModeChange = (nextMode: 'list' | 'editor') => {
      if (onModeChange) {
        onModeChange(nextMode);
      } else {
        setLocalMode(nextMode);
      }
    };

    const showGrid = appSettings.appSettings.editorShowGrid;
    const snapToGrid = appSettings.appSettings.editorSnapToGrid;
    const gridSize = appSettings.appSettings.editorGridSize;

    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(
      null
    );
    const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
    const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

    const [monitors, setMonitors] = useState<OverlayMonitor[]>([]);

    const [isUploadingBackground, setIsUploadingBackground] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [draftName, setDraftName] = useState('');
    const pendingNameFocusRef = useRef(false);
    const nameInputCallbackRef = useCallback((node: InputRef | null) => {
      if (node && pendingNameFocusRef.current) {
        pendingNameFocusRef.current = false;
        node.focus?.();
      }
    }, []);
    const backgroundInputRef = useRef<HTMLInputElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const [lockedRatios, setLockedRatios] = useState<Record<string, boolean>>(
      {}
    );
    const [isCustomResModalOpen, setIsCustomResModalOpen] = useState(false);
    const [customWidth, setCustomWidth] = useState(1920);
    const [customHeight, setCustomHeight] = useState(1080);

    const activeId = widgetSettings.activeLayoutId;
    const activeLayout = widgetSettings.activeLayout;

    const selectedWidget = selectedWidgetId
      ? widgetSettings.getWidget(selectedWidgetId)
      : undefined;

    const toggleFullscreen = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void rootRef.current?.requestFullscreen();
      }
    };

    useEffect(() => {
      listOverlayMonitors().then(setMonitors).catch(console.error);
    }, []);

    useEffect(() => {
      const onChange = () => {
        const fullscreen = !!document.fullscreenElement;

        setIsFullscreen(fullscreen);

        if (!fullscreen) {
          setIsPanelOpen(false);
        }
      };

      document.addEventListener('fullscreenchange', onChange);

      return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const handlePickBackground = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file = event.target.files?.[0];

      event.target.value = '';

      if (!file || !activeId) {
        return;
      }

      setIsUploadingBackground(true);

      try {
        const extension = (file.name.split('.').pop() ?? 'png').toLowerCase();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const previous = widgetSettings.activeLayout?.backgroundImage;

        const fileName = await saveBackgroundImage(activeId, bytes, extension);

        if (previous && previous !== fileName) {
          void deleteBackgroundImage(previous);
        }

        widgetSettings.setActiveLayoutBackground(fileName);
      } catch (error) {
        console.error('Failed to save background image:', error);
      } finally {
        setIsUploadingBackground(false);
      }
    };

    const handleClearBackground = () => {
      void deleteBackgroundImage(activeLayout?.backgroundImage);
      widgetSettings.setActiveLayoutBackground(undefined);
    };

    const handleDeleteLayout = () => {
      if (!activeId) {
        return;
      }

      void deleteBackgroundImage(widgetSettings.activeLayout?.backgroundImage);
      widgetSettings.deleteLayout(activeId);
    };

    const layoutOptions = widgetSettings.layouts.map((layout) => ({
      value: layout.id,
      label: layout.name,
    }));

    const monitorOptions = [
      ...monitors.map((monitor) => ({
        value: monitor.name,
        label: `${monitor.name} (${monitor.resolution.width}×${monitor.resolution.height})`,
      })),
      { value: 'custom', label: 'Custom Resolution...' },
    ];

    if (activeLayout?.activeMonitorName === 'Custom') {
      const config = activeLayout.monitorConfigs['Custom'];
      const res = config?.resolution ?? { width: 1920, height: 1080 };

      monitorOptions.unshift({
        value: 'Custom',
        label: `Custom (${res.width}×${res.height})`,
      });
    }

    const handleSelectMonitor = (name: string) => {
      if (name === 'custom') {
        const currentConfig = activeLayout?.monitorConfigs['Custom'];

        setCustomWidth(
          currentConfig?.resolution.width ??
            widgetSettings.overlayResolution.width
        );
        setCustomHeight(
          currentConfig?.resolution.height ??
            widgetSettings.overlayResolution.height
        );
        setIsCustomResModalOpen(true);

        return;
      }

      const monitor = monitors.find((candidate) => candidate.name === name);

      if (!monitor) return;

      widgetSettings.selectMonitorForActiveLayout(name, monitor.resolution);
    };

    const handleSnap = (pos: SnapPosition) => {
      if (!selectedWidget) return;

      const width = selectedWidget.userSettings.currentWidth;
      const height = selectedWidget.userSettings.currentHeight;
      const worldWidth = widgetSettings.overlayResolution.width;
      const worldHeight = widgetSettings.overlayResolution.height;
      const m = 8; // SNAP_MARGIN

      const positions = {
        topLeft: { x: m, y: m },
        topCenter: { x: Math.round((worldWidth - width) / 2), y: m },
        topRight: { x: worldWidth - width - m, y: m },
        midLeft: { x: m, y: Math.round((worldHeight - height) / 2) },
        center: {
          x: Math.round((worldWidth - width) / 2),
          y: Math.round((worldHeight - height) / 2),
        },
        midRight: {
          x: worldWidth - width - m,
          y: Math.round((worldHeight - height) / 2),
        },
        bottomLeft: { x: m, y: worldHeight - height - m },
        bottomCenter: {
          x: Math.round((worldWidth - width) / 2),
          y: worldHeight - height - m,
        },
        bottomRight: { x: worldWidth - width - m, y: worldHeight - height - m },
      };

      const { x, y } = positions[pos];
      widgetSettings.pushUndo();
      widgetSettings.updatePosition(selectedWidget.id, x, y);
    };

    const handleSelectWidget = (id: string) => {
      setSelectedWidgetId(id === '' ? null : id);
    };

    const handleCreate = () => {
      const trimmed = newName.trim();

      if (!trimmed) {
        return;
      }

      widgetSettings.saveLayout(trimmed);
      setNewName('');
      setIsCreating(false);
    };

    const handleRenameConfirm = () => {
      if (activeId && draftName.trim()) {
        widgetSettings.renameLayout(activeId, draftName);
      }

      setIsRenaming(false);
    };

    const handleCreateKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleCreate();
      } else if (event.key === 'Escape') {
        setIsCreating(false);
      }
    };

    const handleRenameKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleRenameConfirm();
      } else if (event.key === 'Escape') {
        setIsRenaming(false);
      }
    };

    if (activeMode === 'list') {
      return <LayoutList onOpenEditor={() => handleModeChange('editor')} />;
    }

    return (
      <ConfigProvider
        getPopupContainer={() => rootRef.current || document.body}
      >
        <div
          className={`${styles.root} ${isFullscreen ? styles.rootFullscreen : ''}`}
          ref={rootRef}
        >
          <header
            className={`${styles.toolbar} ${
              isFullscreen ? styles.toolbarFullscreen : ''
            }`}
          >
            {!isFullscreen && (
              <Button
                size="small"
                icon={<ArrowLeft size={14} />}
                onClick={() => handleModeChange('list')}
              >
                Back to Layouts
              </Button>
            )}

            {isFullscreen && (
              <Tooltip title="Toggle widget panel">
                <Button
                  size="small"
                  type={isPanelOpen ? 'primary' : 'text'}
                  icon={<PanelLeft size={14} />}
                  onClick={() => setIsPanelOpen((open) => !open)}
                />
              </Tooltip>
            )}

            <div className={styles.layoutControls}>
              {isCreating ? (
                <>
                  <Input
                    ref={nameInputCallbackRef}
                    size="small"
                    placeholder="New layout name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    className={styles.nameInput}
                  />
                  <Tooltip title="Create">
                    <Button
                      size="small"
                      type="text"
                      icon={<Check size={14} />}
                      onClick={handleCreate}
                    />
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <Button
                      size="small"
                      type="text"
                      icon={<X size={14} />}
                      onClick={() => setIsCreating(false)}
                    />
                  </Tooltip>
                </>
              ) : isRenaming ? (
                <>
                  <Input
                    ref={nameInputCallbackRef}
                    size="small"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    className={styles.nameInput}
                  />
                  <Tooltip title="Save name">
                    <Button
                      size="small"
                      type="text"
                      icon={<Check size={14} />}
                      onClick={handleRenameConfirm}
                    />
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <Button
                      size="small"
                      type="text"
                      icon={<X size={14} />}
                      onClick={() => setIsRenaming(false)}
                    />
                  </Tooltip>
                </>
              ) : (
                <>
                  <Select
                    size="small"
                    className={styles.layoutSelect}
                    placeholder="Select a layout…"
                    value={activeId ?? undefined}
                    onChange={(id) => widgetSettings.loadLayout(id)}
                    options={layoutOptions}
                  />

                  <Tooltip title="New layout">
                    <Button
                      size="small"
                      type="text"
                      icon={<Plus size={14} />}
                      onClick={() => {
                        setNewName('');
                        pendingNameFocusRef.current = true;
                        setIsCreating(true);
                      }}
                    />
                  </Tooltip>

                  <Tooltip title="Rename">
                    <Button
                      size="small"
                      type="text"
                      icon={<Pencil size={14} />}
                      disabled={!activeLayout}
                      onClick={() => {
                        setDraftName(activeLayout?.name ?? '');
                        pendingNameFocusRef.current = true;
                        setIsRenaming(true);
                      }}
                    />
                  </Tooltip>

                  <Popconfirm
                    title="Delete this layout?"
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                    disabled={!activeId}
                    onConfirm={handleDeleteLayout}
                  >
                    <Tooltip title="Delete">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<Trash2 size={14} />}
                        disabled={!activeId}
                      />
                    </Tooltip>
                  </Popconfirm>
                </>
              )}
            </div>

            <Tooltip title="Monitor this layout is authored for">
              <Select
                size="small"
                placeholder={
                  <>
                    <Monitor size={12} /> Monitor…
                  </>
                }
                value={activeLayout?.activeMonitorName ?? undefined}
                onChange={handleSelectMonitor}
                options={monitorOptions}
                disabled={!activeLayout}
                style={{ minWidth: 180 }}
              />
            </Tooltip>

            <div className={styles.previewControls}>
              {selectedWidget && (
                <div className={styles.coords}>
                  <span className={styles.coordLabel}>X</span>
                  <InputNumber
                    size="small"
                    className={styles.coordInput}
                    value={selectedWidget.userSettings.x}
                    onChange={(value) => {
                      if (typeof value === 'number') {
                        widgetSettings.pushUndo();
                        widgetSettings.updatePosition(
                          selectedWidget.id,
                          value,
                          selectedWidget.userSettings.y
                        );
                      }
                    }}
                  />
                  <span className={styles.coordLabel}>Y</span>
                  <InputNumber
                    size="small"
                    className={styles.coordInput}
                    value={selectedWidget.userSettings.y}
                    onChange={(value) => {
                      if (typeof value === 'number') {
                        widgetSettings.pushUndo();
                        widgetSettings.updatePosition(
                          selectedWidget.id,
                          selectedWidget.userSettings.x,
                          value
                        );
                      }
                    }}
                  />
                  <span className={styles.coordLabel}>W</span>
                  <InputNumber
                    size="small"
                    className={styles.coordInput}
                    min={10}
                    value={selectedWidget.userSettings.currentWidth}
                    onChange={(value) => {
                      if (typeof value === 'number') {
                        widgetSettings.pushUndo();

                        if (
                          lockedRatios[selectedWidget.id] &&
                          selectedWidget.userSettings.currentHeight > 0
                        ) {
                          const ratio =
                            selectedWidget.userSettings.currentWidth /
                            selectedWidget.userSettings.currentHeight;
                          const newHeight = Math.max(
                            10,
                            Math.round(value / ratio)
                          );

                          widgetSettings.updateSize(
                            selectedWidget.id,
                            value,
                            newHeight
                          );
                        } else {
                          widgetSettings.updateSize(
                            selectedWidget.id,
                            value,
                            selectedWidget.userSettings.currentHeight
                          );
                        }
                      }
                    }}
                  />
                  <span className={styles.coordLabel}>H</span>
                  <InputNumber
                    size="small"
                    className={styles.coordInput}
                    min={10}
                    value={selectedWidget.userSettings.currentHeight}
                    onChange={(value) => {
                      if (typeof value === 'number') {
                        widgetSettings.pushUndo();

                        if (
                          lockedRatios[selectedWidget.id] &&
                          selectedWidget.userSettings.currentWidth > 0
                        ) {
                          const ratio =
                            selectedWidget.userSettings.currentWidth /
                            selectedWidget.userSettings.currentHeight;
                          const newWidth = Math.max(
                            10,
                            Math.round(value * ratio)
                          );

                          widgetSettings.updateSize(
                            selectedWidget.id,
                            newWidth,
                            value
                          );
                        } else {
                          widgetSettings.updateSize(
                            selectedWidget.id,
                            selectedWidget.userSettings.currentWidth,
                            value
                          );
                        }
                      }
                    }}
                  />

                  <Tooltip
                    title={
                      lockedRatios[selectedWidget.id]
                        ? 'Unlock aspect ratio'
                        : 'Lock aspect ratio'
                    }
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={
                        lockedRatios[selectedWidget.id] ? (
                          <Lock size={12} />
                        ) : (
                          <Unlock size={12} />
                        )
                      }
                      onClick={() => {
                        setLockedRatios((prev) => ({
                          ...prev,
                          [selectedWidget.id]: !prev[selectedWidget.id],
                        }));
                      }}
                    />
                  </Tooltip>

                  <Tooltip title="Bring to front">
                    <Button
                      size="small"
                      type="text"
                      icon={<BringToFront size={12} />}
                      onClick={() =>
                        widgetSettings.bringToFront(selectedWidget.id)
                      }
                    />
                  </Tooltip>

                  <Tooltip title="Send to back">
                    <Button
                      size="small"
                      type="text"
                      icon={<SendToBack size={12} />}
                      onClick={() =>
                        widgetSettings.sendToBack(selectedWidget.id)
                      }
                    />
                  </Tooltip>

                  <Popover
                    trigger="click"
                    placement="bottom"
                    getPopupContainer={() => rootRef.current || document.body}
                    content={
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 32px)',
                          gap: '4px',
                        }}
                      >
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowUpLeft size={14} />}
                          onClick={() => handleSnap('topLeft')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowUp size={14} />}
                          onClick={() => handleSnap('topCenter')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowUpRight size={14} />}
                          onClick={() => handleSnap('topRight')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowLeft size={14} />}
                          onClick={() => handleSnap('midLeft')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<Maximize2 size={14} />}
                          onClick={() => handleSnap('center')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowRight size={14} />}
                          onClick={() => handleSnap('midRight')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowDownLeft size={14} />}
                          onClick={() => handleSnap('bottomLeft')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowDown size={14} />}
                          onClick={() => handleSnap('bottomCenter')}
                        />
                        <Button
                          size="small"
                          type="text"
                          icon={<ArrowDownRight size={14} />}
                          onClick={() => handleSnap('bottomRight')}
                        />
                      </div>
                    }
                  >
                    <Tooltip title="Quick placement">
                      <Button
                        size="small"
                        type="text"
                        icon={<LayoutGrid size={14} />}
                      />
                    </Tooltip>
                  </Popover>
                </div>
              )}

              <span className={styles.resolutionLabel}>
                {widgetSettings.overlayResolution.width}×
                {widgetSettings.overlayResolution.height}
              </span>

              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                aria-label="Layout background image"
                hidden
                onChange={(event) => void handlePickBackground(event)}
              />

              <Tooltip title="Undo (Ctrl+Z)">
                <Button
                  size="small"
                  type="text"
                  icon={<Undo2 size={14} />}
                  disabled={widgetSettings.undoStack.length === 0}
                  onClick={() => widgetSettings.undo()}
                />
              </Tooltip>

              <Tooltip title="Redo (Ctrl+Y)">
                <Button
                  size="small"
                  type="text"
                  icon={<Redo2 size={14} />}
                  disabled={widgetSettings.redoStack.length === 0}
                  onClick={() => widgetSettings.redo()}
                />
              </Tooltip>

              <Tooltip title="Toggle alignment grid">
                <Button
                  size="small"
                  type={showGrid ? 'primary' : 'text'}
                  icon={<Grid3x3 size={14} />}
                  onClick={() => appSettings.setEditorShowGrid(!showGrid)}
                />
              </Tooltip>

              {showGrid && (
                <Tooltip title="Grid size">
                  <Select
                    size="small"
                    value={gridSize}
                    onChange={(value) => appSettings.setEditorGridSize(value)}
                    options={GRID_SIZE_OPTIONS}
                    style={{ minWidth: 72 }}
                  />
                </Tooltip>
              )}

              <Tooltip title="Snap to grid">
                <Button
                  size="small"
                  type={snapToGrid ? 'primary' : 'text'}
                  icon={<Magnet size={14} />}
                  onClick={() => appSettings.setEditorSnapToGrid(!snapToGrid)}
                />
              </Tooltip>

              <Tooltip
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen preview'}
              >
                <Button
                  size="small"
                  type="text"
                  icon={
                    isFullscreen ? (
                      <Minimize size={14} />
                    ) : (
                      <Maximize size={14} />
                    )
                  }
                  onClick={toggleFullscreen}
                />
              </Tooltip>

              <Tooltip title="Set editor background (e.g. cockpit view)">
                <Button
                  size="small"
                  type="text"
                  icon={<Image size={14} />}
                  disabled={!activeLayout}
                  onClick={() => backgroundInputRef.current?.click()}
                />
              </Tooltip>

              {activeLayout?.backgroundImage && (
                <Tooltip title="Clear background">
                  <Button
                    size="small"
                    type="text"
                    icon={<ImageOff size={14} />}
                    onClick={handleClearBackground}
                  />
                </Tooltip>
              )}

              <Select
                size="small"
                value={scenarioId}
                onChange={setScenarioId}
                options={SCENARIO_OPTIONS}
                style={{ minWidth: 150 }}
              />
            </div>
          </header>

          <div
            className={`${styles.body} ${isFullscreen ? styles.bodyFullscreen : ''}`}
          >
            <aside
              className={`${
                isFullscreen ? styles.panelDrawer : styles.panel
              } ${isFullscreen && isPanelOpen ? styles.panelDrawerOpen : ''}`}
            >
              {isFullscreen && (
                <div className={styles.panelDrawerHeader}>
                  <span className={styles.panelDrawerTitle}>Widgets</span>
                  <Tooltip title="Hide panel">
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelLeftClose size={16} />}
                      onClick={() => setIsPanelOpen(false)}
                    />
                  </Tooltip>
                </div>
              )}

              <LayoutWidgetPanel
                selectedWidgetId={selectedWidgetId}
                editingWidgetId={editingWidgetId}
                onSelectWidget={handleSelectWidget}
                onEditWidget={setEditingWidgetId}
              />
            </aside>

            <main
              className={`${styles.canvas} ${
                isFullscreen ? styles.canvasFullscreen : ''
              }`}
            >
              <LayoutCanvas
                scenarioId={scenarioId}
                showGrid={showGrid}
                snapToGrid={snapToGrid}
                gridSize={gridSize}
                fullscreen={isFullscreen}
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={handleSelectWidget}
                isUploading={isUploadingBackground}
                isRatioLocked={
                  selectedWidgetId ? !!lockedRatios[selectedWidgetId] : false
                }
              />
            </main>
          </div>

          <Modal
            title="Custom Screen Resolution"
            open={isCustomResModalOpen}
            getContainer={() => rootRef.current || document.body}
            onOk={() => {
              widgetSettings.selectMonitorForActiveLayout('Custom', {
                width: customWidth,
                height: customHeight,
              });
              setIsCustomResModalOpen(false);
            }}
            onCancel={() => setIsCustomResModalOpen(false)}
            okText="Apply"
            cancelText="Cancel"
          >
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <div>
                <div style={{ marginBottom: '4px' }}>Width (px)</div>
                <InputNumber
                  min={800}
                  max={7680}
                  value={customWidth}
                  onChange={(val) => val && setCustomWidth(val)}
                  style={{ width: '120px' }}
                />
              </div>
              <div>
                <div style={{ marginBottom: '4px' }}>Height (px)</div>
                <InputNumber
                  min={600}
                  max={4320}
                  value={customHeight}
                  onChange={(val) => val && setCustomHeight(val)}
                  style={{ width: '120px' }}
                />
              </div>
            </div>
          </Modal>
        </div>
      </ConfigProvider>
    );
  }
);
