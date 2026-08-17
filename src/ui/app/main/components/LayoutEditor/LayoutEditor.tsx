import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Tooltip,
  Popover,
  ConfigProvider,
} from 'antd';
import type { InputRef } from 'antd';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Play,
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
  MonitorUp,
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
  Rows3,
} from 'lucide-react';
import {
  useAppSettingsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { LayoutCanvas } from './LayoutCanvas';
import { LayoutWidgetPanel } from './LayoutWidgetPanel';
import { LayoutList } from './LayoutList';
import {
  saveBackgroundImage,
  deleteBackgroundImage,
} from '@store/settings/layout-background';
import { isRemoteMonitor } from '@utils/remote-screen';
import { AddRemoteScreenButton } from './AddRemoteScreenButton';
import { monitorForWidget } from '@store/settings/virtual-desktop';
import styles from './LayoutEditor.module.scss';

const SNAP_MARGIN = 8;

// Sentinel for the picker entry that zooms the canvas out to the whole desktop.
const ALL_MONITORS = '__all__';

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
    const { t } = useTranslation('main-app');

    const [localMode, setLocalMode] = useState<'list' | 'editor'>('list');

    const activeMode = onModeChange ? mode : localMode;

    const handleModeChange = (nextMode: 'list' | 'editor') => {
      if (onModeChange) {
        onModeChange(nextMode);
      } else {
        setLocalMode(nextMode);
      }
    };

    // When the editor is opened for a layout that wasn't previously active,
    // prevActiveId holds the id we should restore when the user goes back
    // without clicking "Make Active".
    const [prevActiveId, setPrevActiveId] = useState<string | null>(null);

    const handleOpenEditorWithId = (id: string) => {
      const currentActiveId = widgetSettings.activeLayoutId;

      if (id !== currentActiveId) {
        widgetSettings.switchEditorLayout(id);
        setPrevActiveId(currentActiveId);
      } else {
        setPrevActiveId(null);
      }

      handleModeChange('editor');
    };

    const handleBack = () => {
      if (prevActiveId) {
        widgetSettings.loadLayout(prevActiveId);
        setPrevActiveId(null);
      } else {
        widgetSettings.activateEditorLayout();
      }

      handleModeChange('list');
    };

    const handleMakeActive = () => {
      widgetSettings.activateEditorLayout();
      setPrevActiveId(null);
    };

    const isEditingLayoutActive = prevActiveId === null;

    const showGrid = appSettings.appSettings.editorShowGrid;
    const snapToGrid = appSettings.appSettings.editorSnapToGrid;
    const gridSize = appSettings.appSettings.editorGridSize;

    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(
      null
    );
    const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
    const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

    // Which screen fills the canvas. Null shows every monitor of the layout at
    // once — needed to drag widgets between screens, useless for fine work.
    const [focusedMonitorName, setFocusedMonitorName] = useState<string | null>(
      null
    );

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

    const activeId = widgetSettings.activeLayoutId;
    const activeLayout = widgetSettings.activeLayout;
    const monitors = widgetSettings.attachedMonitors;

    // Background images belong to a screen, so setting one needs a screen in
    // focus; in overview the first monitor is the sensible target.
    const backgroundTargetName =
      focusedMonitorName ?? activeLayout?.monitors[0]?.name;

    const prevActiveIdRef = useRef(activeId);

    useEffect(() => {
      if (prevActiveIdRef.current !== activeId) {
        prevActiveIdRef.current = activeId;
        setSelectedWidgetId(null);
        setEditingWidgetId(null);
      }
    }, [activeId]);

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
        setIsUploadingBackground(false);

        return;
      }

      try {
        const extension = (file.name.split('.').pop() ?? 'png').toLowerCase();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const previous = backgroundTargetName
          ? widgetSettings.activeLayout?.backgroundImages?.[
              backgroundTargetName
            ]
          : undefined;

        const fileName = await saveBackgroundImage(activeId, bytes, extension);

        if (previous && previous !== fileName) {
          void deleteBackgroundImage(previous);
        }

        if (backgroundTargetName) {
          widgetSettings.setMonitorBackground(backgroundTargetName, fileName);
        }
      } catch (error) {
        console.error('Failed to save background image:', error);
      } finally {
        setIsUploadingBackground(false);
      }
    };

    const handleClearBackground = () => {
      if (!backgroundTargetName) return;

      void deleteBackgroundImage(
        activeLayout?.backgroundImages?.[backgroundTargetName]
      );
      widgetSettings.setMonitorBackground(backgroundTargetName, undefined);
    };

    const handleDeleteLayout = () => {
      if (!activeId) {
        return;
      }

      for (const image of Object.values(
        widgetSettings.activeLayout?.backgroundImages ?? {}
      )) {
        void deleteBackgroundImage(image);
      }

      widgetSettings.deleteLayout(activeId);
    };

    const layoutOptions = widgetSettings.layouts.map((layout) => ({
      value: layout.id,
      label: layout.name,
    }));

    const layoutMonitorNames = new Set(
      (activeLayout?.monitors ?? []).map((monitor) => monitor.name)
    );

    // The picker does double duty: it zooms the canvas to one screen, and it is
    // how a screen joins the layout in the first place. Attached monitors that
    // are not part of the layout yet are offered with an "add" hint.
    const monitorOptions = [
      {
        value: ALL_MONITORS,
        label: t('layoutEditor.allMonitors'),
        inLayout: false,
      },
      ...monitors.map((monitor) => ({
        value: monitor.name,
        inLayout: layoutMonitorNames.has(monitor.name),
        label: layoutMonitorNames.has(monitor.name)
          ? `${monitor.name} · ${monitor.bounds.width}×${monitor.bounds.height}`
          : `${monitor.name} · ${t('layoutEditor.monitorAdd')}`,
      })),
      // Remote screens live in the layout only — the machine has no display to
      // offer them from, so they are listed straight from the layout itself.
      ...(activeLayout?.monitors ?? [])
        .filter(isRemoteMonitor)
        .map((monitor) => ({
          value: monitor.name,
          inLayout: true,
          label: `${monitor.name} · ${monitor.bounds.width}×${monitor.bounds.height} · ${t('layoutEditor.remoteScreenTag')}`,
        })),
    ];

    const hasRemoteScreens = (activeLayout?.monitors ?? []).some(
      isRemoteMonitor
    );

    const moveTargetOptions = (activeLayout?.monitors ?? [])
      .filter((monitor) => monitor.name !== focusedMonitorName)
      .map((monitor) => ({ value: monitor.name, label: monitor.name }));

    // Dropping a screen leaves its widgets on the first remaining monitor
    // rather than deleting them — a mis-click here must not cost a layout.
    const handleRemoveMonitor = (monitorName: string) => {
      if (!activeId) return;

      widgetSettings.removeMonitor(activeId, monitorName);

      if (focusedMonitorName === monitorName) {
        setFocusedMonitorName(null);
      }
    };

    const handleSelectMonitor = (name: string) => {
      if (name === ALL_MONITORS) {
        setFocusedMonitorName(null);

        return;
      }

      // A remote screen is already part of the layout, so selecting one only
      // ever means focusing it.
      if (
        layoutMonitorNames.has(name) &&
        !monitors.some((candidate) => candidate.name === name)
      ) {
        setFocusedMonitorName(name);

        return;
      }

      const monitor = monitors.find((candidate) => candidate.name === name);

      if (!monitor) return;

      if (!layoutMonitorNames.has(name)) {
        widgetSettings.addMonitor({
          name: monitor.name,
          bounds: monitor.bounds,
        });
      }

      setFocusedMonitorName(name);
    };

    const handleSnap = (pos: SnapPosition) => {
      if (!selectedWidget) return;

      const width = selectedWidget.userSettings.currentWidth;
      // autoHeight widgets size themselves from content, so the stored
      // currentHeight is stale -- measure the real rendered box and convert
      // it from screen pixels (the canvas is zoomed via CSS transform: scale)
      // back to world units using the known width as a scale reference.
      const widgetElement = document.querySelector(
        `[data-widget-id="${selectedWidget.id}"]`
      );
      const widgetRect = widgetElement?.getBoundingClientRect();
      const height =
        selectedWidget.autoHeight && widgetRect && widgetRect.width > 0
          ? Math.round(widgetRect.height * (width / widgetRect.width))
          : selectedWidget.userSettings.currentHeight;
      // Widget coordinates are virtual-desktop wide, so the corners are those
      // of the screen the widget currently sits on, not of the desktop box.
      const monitors = widgetSettings.activeLayout?.monitors ?? [];
      const screen = monitorForWidget(selectedWidget, monitors)?.bounds ?? {
        x: 0,
        y: 0,
        width: widgetSettings.overlayResolution.width,
        height: widgetSettings.overlayResolution.height,
      };
      const left = screen.x + SNAP_MARGIN;
      const right = screen.x + screen.width - width - SNAP_MARGIN;
      const top = screen.y + SNAP_MARGIN;
      const bottom = screen.y + screen.height - height - SNAP_MARGIN;
      const centerX = Math.round(screen.x + (screen.width - width) / 2);
      const centerY = Math.round(screen.y + (screen.height - height) / 2);
      const positions = {
        topLeft: { x: left, y: top },
        topCenter: { x: centerX, y: top },
        topRight: { x: right, y: top },
        midLeft: { x: left, y: centerY },
        center: { x: centerX, y: centerY },
        midRight: { x: right, y: centerY },
        bottomLeft: { x: left, y: bottom },
        bottomCenter: { x: centerX, y: bottom },
        bottomRight: { x: right, y: bottom },
      };

      const { x, y } = positions[pos];
      widgetSettings.pushUndo();
      widgetSettings.updatePosition(selectedWidget.id, x, y);
    };

    const handleSelectWidget = (id: string) => {
      setSelectedWidgetId(id === '' ? null : id);
      setEditingWidgetId(null);
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
      // An IME (Japanese/Chinese/Korean) uses Enter to confirm a candidate
      // word; committing here would swallow that keystroke mid-composition.
      if (event.nativeEvent.isComposing) {
        return;
      }

      if (event.key === 'Enter') {
        handleCreate();
      } else if (event.key === 'Escape') {
        setIsCreating(false);
      }
    };

    const handleRenameKeyDown = (event: React.KeyboardEvent) => {
      if (event.nativeEvent.isComposing) {
        return;
      }

      if (event.key === 'Enter') {
        handleRenameConfirm();
      } else if (event.key === 'Escape') {
        setIsRenaming(false);
      }
    };

    if (activeMode === 'list') {
      return <LayoutList onOpenEditor={handleOpenEditorWithId} />;
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
                onClick={handleBack}
              >
                {t('layoutEditor.backToLayouts')}
              </Button>
            )}

            {isFullscreen && (
              <Tooltip title={t('layoutEditor.toggleWidgetPanel')}>
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
                    placeholder={t('layoutEditor.newLayoutNamePlaceholder')}
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={handleCreateKeyDown}
                    className={styles.nameInput}
                  />
                  <Tooltip title={t('layoutEditor.create')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<Check size={14} />}
                      onClick={handleCreate}
                    />
                  </Tooltip>
                  <Tooltip title={t('layoutEditor.cancel')}>
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
                  <Tooltip title={t('layoutEditor.saveName')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<Check size={14} />}
                      onClick={handleRenameConfirm}
                    />
                  </Tooltip>
                  <Tooltip title={t('layoutEditor.cancel')}>
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
                    placeholder={t('layoutEditor.selectLayoutPlaceholder')}
                    value={activeId ?? undefined}
                    onChange={(id) => {
                      const trueActiveId =
                        prevActiveId ?? widgetSettings.activeLayoutId;

                      if (id === trueActiveId) {
                        widgetSettings.loadLayout(id);
                        setPrevActiveId(null);
                      } else {
                        if (prevActiveId === null) {
                          setPrevActiveId(widgetSettings.activeLayoutId);
                        }

                        widgetSettings.switchEditorLayout(id);
                      }
                    }}
                    options={layoutOptions}
                  />

                  <Tooltip title={t('layoutEditor.newLayout')}>
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

                  <Tooltip title={t('layoutEditor.rename')}>
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
                    title={t('layoutEditor.deleteLayoutConfirm')}
                    okText={t('layoutEditor.delete')}
                    okButtonProps={{ danger: true }}
                    cancelText={t('layoutEditor.cancel')}
                    disabled={!activeId}
                    onConfirm={handleDeleteLayout}
                  >
                    <Tooltip title={t('layoutEditor.delete')}>
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

            {isEditingLayoutActive ? (
              <span className={styles.activeChip}>
                {t('layoutEditor.active')}
              </span>
            ) : (
              <Tooltip title={t('layoutEditor.applyLayoutTooltip')}>
                <Button
                  size="small"
                  type="primary"
                  icon={<Play size={14} />}
                  onClick={handleMakeActive}
                >
                  {t('layoutEditor.makeActive')}
                </Button>
              </Tooltip>
            )}

            <AddRemoteScreenButton />

            {hasRemoteScreens && (
              <Tooltip title={t('layoutEditor.arrangeRemoteScreensTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Rows3 size={14} />}
                  onClick={() => widgetSettings.arrangeRemoteScreens()}
                >
                  {t('layoutEditor.arrangeRemoteScreens')}
                </Button>
              </Tooltip>
            )}

            <Tooltip title={t('layoutEditor.monitorTooltip')}>
              <Select
                size="small"
                placeholder={
                  <>
                    <Monitor size={12} /> {t('layoutEditor.monitorPlaceholder')}
                  </>
                }
                value={focusedMonitorName ?? ALL_MONITORS}
                onChange={handleSelectMonitor}
                options={monitorOptions}
                optionRender={(option) => (
                  <div className={styles.monitorOption}>
                    <span className={styles.monitorOptionLabel}>
                      {option.label}
                    </span>

                    {option.data.inLayout && (
                      <button
                        type="button"
                        className={styles.monitorOptionRemove}
                        tabIndex={-1}
                        title={t('layoutEditor.removeMonitor')}
                        // The click must not reach the option itself, or
                        // removing a screen would also focus it.
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleRemoveMonitor(String(option.value));
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
                disabled={!activeLayout}
                popupMatchSelectWidth={240}
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
                    onFocus={() => widgetSettings.pushUndo()}
                    onChange={(value) => {
                      if (typeof value === 'number') {
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
                    onFocus={() => widgetSettings.pushUndo()}
                    onChange={(value) => {
                      if (typeof value === 'number') {
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
                    onFocus={() => widgetSettings.pushUndo()}
                    onChange={(value) => {
                      if (typeof value === 'number') {
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
                    onFocus={() => widgetSettings.pushUndo()}
                    onChange={(value) => {
                      if (typeof value === 'number') {
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
                        ? t('layoutEditor.unlockAspectRatio')
                        : t('layoutEditor.lockAspectRatio')
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

                  {moveTargetOptions.length > 0 && (
                    <Tooltip title={t('layoutEditor.moveToMonitor')}>
                      <Select
                        size="small"
                        value={null}
                        placeholder={<MonitorUp size={12} />}
                        onChange={(monitorName: string) =>
                          widgetSettings.moveWidgetToMonitor(
                            selectedWidget.id,
                            monitorName
                          )
                        }
                        options={moveTargetOptions}
                        popupMatchSelectWidth={200}
                        style={{ width: 56 }}
                      />
                    </Tooltip>
                  )}

                  <Tooltip title={t('layoutEditor.bringToFront')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<BringToFront size={12} />}
                      onClick={() =>
                        widgetSettings.bringToFront(selectedWidget.id)
                      }
                    />
                  </Tooltip>

                  <Tooltip title={t('layoutEditor.sendToBack')}>
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
                    <Tooltip title={t('layoutEditor.quickPlacement')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<LayoutGrid size={14} />}
                      />
                    </Tooltip>
                  </Popover>
                </div>
              )}

              <input
                ref={(node) => {
                  backgroundInputRef.current = node;

                  if (node) {
                    node.oncancel = () => setIsUploadingBackground(false);
                  }
                }}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                aria-label={t('layoutEditor.backgroundImageAria')}
                hidden
                onChange={(event) => void handlePickBackground(event)}
              />

              <Tooltip title={t('layoutEditor.undoTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Undo2 size={14} />}
                  disabled={!widgetSettings.history.canUndo}
                  onClick={() => widgetSettings.undo()}
                />
              </Tooltip>

              <Tooltip title={t('layoutEditor.redoTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Redo2 size={14} />}
                  disabled={!widgetSettings.history.canRedo}
                  onClick={() => widgetSettings.redo()}
                />
              </Tooltip>

              <Tooltip title={t('layoutEditor.toggleGridTooltip')}>
                <Button
                  size="small"
                  type={showGrid ? 'primary' : 'text'}
                  icon={<Grid3x3 size={14} />}
                  onClick={() => appSettings.setEditorShowGrid(!showGrid)}
                />
              </Tooltip>

              {showGrid && (
                <Tooltip title={t('layoutEditor.gridSizeTooltip')}>
                  <Select
                    size="small"
                    value={gridSize}
                    onChange={(value) => appSettings.setEditorGridSize(value)}
                    options={GRID_SIZE_OPTIONS}
                    style={{ minWidth: 72 }}
                  />
                </Tooltip>
              )}

              <Tooltip title={t('layoutEditor.snapToGridTooltip')}>
                <Button
                  size="small"
                  type={snapToGrid ? 'primary' : 'text'}
                  icon={<Magnet size={14} />}
                  onClick={() => appSettings.setEditorSnapToGrid(!snapToGrid)}
                />
              </Tooltip>

              <Tooltip
                title={
                  isFullscreen
                    ? t('layoutEditor.exitFullscreen')
                    : t('layoutEditor.fullscreenPreview')
                }
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

              <Tooltip title={t('layoutEditor.setBackgroundTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Image size={14} />}
                  disabled={!activeLayout}
                  onClick={() => {
                    if (backgroundInputRef.current) {
                      setIsUploadingBackground(true);
                      backgroundInputRef.current.click();
                    }
                  }}
                />
              </Tooltip>

              {backgroundTargetName &&
                activeLayout?.backgroundImages?.[backgroundTargetName] && (
                  <Tooltip title={t('layoutEditor.clearBackgroundTooltip')}>
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
                popupMatchSelectWidth={false}
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
                  <span className={styles.panelDrawerTitle}>
                    {t('layoutEditor.widgetsPanelTitle')}
                  </span>
                  <Tooltip title={t('layoutEditor.hidePanel')}>
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
                focusedMonitorName={focusedMonitorName}
              />
            </main>
          </div>
        </div>
      </ConfigProvider>
    );
  }
);
