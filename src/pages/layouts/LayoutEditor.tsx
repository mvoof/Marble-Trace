import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, ConfigProvider, Select, Tooltip } from 'antd';
import {
  ArrowLeft,
  Grid3x3,
  Magnet,
  Maximize,
  Minimize,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Play,
  Redo2,
  Rows3,
  Undo2,
} from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { monitorForWidget } from '@entities/layout/virtual-desktop';
import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import {
  snappedPosition,
  type SnapPosition,
} from '@features/layout-editor/snap-position';
import { SESSION_PREVIEW_SCENARIOS } from '@features/preview/scenarios';
import { isRemoteMonitor } from '@shared/lib/remote-screen';
import { cx } from '@shared/lib/class-names';

import { AddRemoteScreenButton } from './AddRemoteScreenButton';
import { LayoutCanvas } from './LayoutCanvas';
import { LayoutList } from './LayoutList';
import { LayoutWidgetPanel } from './LayoutWidgetPanel';
import { BackgroundControls } from './toolbar/BackgroundControls';
import { LayoutNameField } from './toolbar/LayoutNameField';
import { MonitorPicker } from './toolbar/MonitorPicker';
import { useToolbarBottom } from './use-toolbar-bottom';
import { WidgetInspector } from './WidgetInspector';
import styles from './LayoutEditor.module.scss';

// The canvas is seeded as a whole, so the bar offers the session-wide moments
// only — a widget's own domain scenarios belong to that widget's picker.
const SCENARIO_OPTIONS = SESSION_PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

const GRID_SIZE_OPTIONS = [10, 15, 20, 30, 40].map((size) => ({
  value: size,
  label: `${size}px`,
}));

const GRID_SELECT_MIN_WIDTH_PX = 72;
const SCENARIO_SELECT_MIN_WIDTH_PX = 150;

type EditorMode = 'list' | 'editor';

/**
 * The Layouts tab: the list of layouts, or the editor of one. The editor's
 * view state is `LayoutEditorUiStore`'s; this component lays the toolbar, the
 * widget panel, the canvas and the inspector out around it.
 */
export const LayoutEditor = observer(
  ({
    mode = 'list',
    onModeChange,
  }: {
    mode?: EditorMode;
    onModeChange?: (mode: EditorMode) => void;
  }) => {
    const liveWidgets = useMainLiveWidgetsStore();
    const layouts = useLayoutsStore();
    const layoutEditor = useLayoutEditorStore();
    const editorUi = useLayoutEditorUiStore();
    const appSettings = useAppSettingsStore();
    const { t } = useTranslation('main-app');

    const [localMode, setLocalMode] = useState<EditorMode>('list');
    const rootRef = useRef<HTMLDivElement | null>(null);
    const toolbarRef = useToolbarBottom(rootRef);

    const activeMode = onModeChange ? mode : localMode;

    const handleModeChange = (nextMode: EditorMode) => {
      if (onModeChange) {
        onModeChange(nextMode);
      } else {
        setLocalMode(nextMode);
      }
    };

    // Which layout is on screen is the store's to remember, not this
    // component's: opening the editor pins it, and everything the user does in
    // here moves the edited layout only until they put it on screen.
    const handleOpenEditorWithId = (id: string) => {
      layoutEditor.setOpen(true);
      layoutEditor.switchLayout(id);

      handleModeChange('editor');
    };

    // Closing hands the screen's layout back as the one being edited; the
    // session auto-switch never stands down, so the overlay has been following
    // the session the whole time the editor was open.
    //
    // The cleanup is registered only on the branch that opened the session,
    // and that is what makes this safe to re-read. React tears the previous
    // effect down before running the new one, so a cleanup that closed
    // unconditionally would close the session the click handler had just
    // opened — handing the editor back the layout that was live instead of the
    // one that was clicked.
    useEffect(() => {
      if (activeMode !== 'editor') {
        layoutEditor.setOpen(false);

        return;
      }

      layoutEditor.setOpen(true);

      return () => {
        layoutEditor.setOpen(false);
      };
    }, [activeMode, layoutEditor]);

    useEffect(() => {
      const onFullscreenChange = () =>
        editorUi.setFullscreen(!!document.fullscreenElement);

      document.addEventListener('fullscreenchange', onFullscreenChange);

      return () =>
        document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [editorUi]);

    const showGrid = appSettings.appSettings.editorShowGrid;
    const snapToGrid = appSettings.appSettings.editorSnapToGrid;
    const gridSize = appSettings.appSettings.editorGridSize;
    const isFullscreen = editorUi.isFullscreen;
    const selectedWidgetId = editorUi.selectedWidgetId;
    const editingLayout = layouts.editingLayout;
    const selectedWidget = selectedWidgetId
      ? liveWidgets.getWidget(selectedWidgetId)
      : undefined;

    const hasRemoteScreens = (editingLayout?.monitors ?? []).some(
      isRemoteMonitor
    );

    const moveTargetOptions = (editingLayout?.monitors ?? [])
      .filter((monitor) => monitor.name !== editorUi.focusedMonitorName)
      .map((monitor) => ({ value: monitor.name, label: monitor.name }));

    const dialogContainer = () => rootRef.current ?? document.body;

    const toggleFullscreen = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void rootRef.current?.requestFullscreen();
      }
    };

    const handleSnap = (position: SnapPosition) => {
      if (!selectedWidget) {
        return;
      }

      const widgetElement = document.querySelector<HTMLElement>(
        `[data-widget-id="${selectedWidget.id}"]`
      );
      // A content-sized widget draws narrower than its stored width, which is
      // only its scale: measure it. `offsetWidth` is already in world units —
      // the canvas zoom is a CSS transform, which layout sizes ignore.
      const width =
        selectedWidget.contentSized && widgetElement
          ? widgetElement.offsetWidth
          : selectedWidget.userSettings.currentWidth;
      // An auto-height widget sizes itself from its content, so the stored
      // height is stale: measure the rendered box and convert it from screen
      // pixels back to world units, the known width as the scale reference.
      const measuredHeight = (): number => {
        if (selectedWidget.contentSized && widgetElement) {
          return widgetElement.offsetHeight;
        }

        const widgetRect = widgetElement?.getBoundingClientRect();

        if (selectedWidget.autoHeight && widgetRect && widgetRect.width > 0) {
          return Math.round(widgetRect.height * (width / widgetRect.width));
        }

        return selectedWidget.userSettings.currentHeight;
      };
      // Widget coordinates are virtual-desktop wide, so the corners are those
      // of the screen the widget sits on, not of the desktop box.
      const screen = monitorForWidget(
        selectedWidget,
        editingLayout?.monitors ?? []
      )?.bounds ?? {
        x: 0,
        y: 0,
        width: liveWidgets.overlayResolution.width,
        height: liveWidgets.overlayResolution.height,
      };
      const { x, y } = snappedPosition(
        position,
        { width, height: measuredHeight() },
        screen
      );

      liveWidgets.pushUndo();
      liveWidgets.updatePosition(selectedWidget.id, x, y);
    };

    const handleToggleRatioLock = () => {
      if (selectedWidgetId) {
        editorUi.toggleRatioLock(selectedWidgetId);
      }
    };

    if (activeMode === 'list') {
      return <LayoutList onOpenEditor={handleOpenEditorWithId} />;
    }

    return (
      <ConfigProvider getPopupContainer={dialogContainer}>
        <div
          className={cx(styles.root, isFullscreen && styles.rootFullscreen)}
          ref={rootRef}
        >
          <header
            ref={toolbarRef}
            className={cx(
              styles.toolbar,
              isFullscreen && styles.toolbarFullscreen
            )}
          >
            {isFullscreen ? (
              <Tooltip title={t('layoutEditor.toggleWidgetPanel')}>
                <Button
                  size="small"
                  type={editorUi.isPanelOpen ? 'primary' : 'text'}
                  icon={<PanelLeft size={14} />}
                  onClick={() => editorUi.setPanelOpen(!editorUi.isPanelOpen)}
                />
              </Tooltip>
            ) : (
              <Button
                size="small"
                icon={<ArrowLeft size={14} />}
                onClick={() => handleModeChange('list')}
              >
                {t('layoutEditor.backToLayouts')}
              </Button>
            )}

            <LayoutNameField />

            {layoutEditor.previewMode ? (
              <Tooltip title={t('layoutEditor.applyLayoutTooltip')}>
                <Button
                  size="small"
                  type="primary"
                  icon={<Play size={14} />}
                  onClick={() => layoutEditor.activateLayout()}
                >
                  {t('layoutEditor.makeActive')}
                </Button>
              </Tooltip>
            ) : (
              <span className={styles.activeChip}>
                {t('layoutEditor.active')}
              </span>
            )}

            <AddRemoteScreenButton />

            {hasRemoteScreens && (
              <Tooltip title={t('layoutEditor.arrangeRemoteScreensTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Rows3 size={14} />}
                  onClick={() => layouts.arrangeRemoteScreens()}
                >
                  {t('layoutEditor.arrangeRemoteScreens')}
                </Button>
              </Tooltip>
            )}

            <MonitorPicker dialogContainer={dialogContainer} />

            <div className={styles.previewControls}>
              <Tooltip title={t('layoutEditor.undoTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Undo2 size={14} />}
                  disabled={!liveWidgets.history.canUndo}
                  onClick={() => liveWidgets.undo()}
                />
              </Tooltip>

              <Tooltip title={t('layoutEditor.redoTooltip')}>
                <Button
                  size="small"
                  type="text"
                  icon={<Redo2 size={14} />}
                  disabled={!liveWidgets.history.canRedo}
                  onClick={() => liveWidgets.redo()}
                />
              </Tooltip>

              <Tooltip title={t('layoutEditor.toggleGridTooltip')}>
                <Button
                  size="small"
                  type={showGrid ? 'primary' : 'text'}
                  icon={<Grid3x3 size={14} />}
                  onClick={() =>
                    appSettings.update({ editorShowGrid: !showGrid })
                  }
                />
              </Tooltip>

              {showGrid && (
                <Tooltip title={t('layoutEditor.gridSizeTooltip')}>
                  <Select
                    size="small"
                    value={gridSize}
                    onChange={(value) =>
                      appSettings.update({ editorGridSize: value })
                    }
                    options={GRID_SIZE_OPTIONS}
                    style={{ minWidth: GRID_SELECT_MIN_WIDTH_PX }}
                  />
                </Tooltip>
              )}

              <Tooltip title={t('layoutEditor.snapToGridTooltip')}>
                <Button
                  size="small"
                  type={snapToGrid ? 'primary' : 'text'}
                  icon={<Magnet size={14} />}
                  onClick={() =>
                    appSettings.update({ editorSnapToGrid: !snapToGrid })
                  }
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

              <BackgroundControls />

              <Select
                size="small"
                value={editorUi.scenarioId}
                onChange={(id) => editorUi.setScenario(id)}
                options={SCENARIO_OPTIONS}
                style={{ minWidth: SCENARIO_SELECT_MIN_WIDTH_PX }}
                popupMatchSelectWidth={false}
              />

              {/* Last on the bar, above the panel it opens: the toggle sits on
                  the side the drawer comes from. */}
              {isFullscreen && (
                <Tooltip title={t('layoutEditor.toggleInspector')}>
                  <Button
                    size="small"
                    type={editorUi.isInspectorOpen ? 'primary' : 'text'}
                    icon={<PanelRight size={14} />}
                    onClick={() =>
                      editorUi.setInspectorOpen(!editorUi.isInspectorOpen)
                    }
                  />
                </Tooltip>
              )}
            </div>
          </header>

          <div
            className={cx(styles.body, isFullscreen && styles.bodyFullscreen)}
          >
            <aside
              className={cx(
                isFullscreen ? styles.panelDrawer : styles.panel,
                isFullscreen && editorUi.isPanelOpen && styles.panelDrawerOpen
              )}
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
                      onClick={() => editorUi.setPanelOpen(false)}
                    />
                  </Tooltip>
                </div>
              )}

              <LayoutWidgetPanel
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={(id) => editorUi.selectWidget(id)}
              />
            </aside>

            <main
              className={cx(
                styles.canvas,
                isFullscreen && styles.canvasFullscreen
              )}
            >
              <LayoutCanvas
                scenarioId={editorUi.scenarioId}
                showGrid={showGrid}
                snapToGrid={snapToGrid}
                gridSize={gridSize}
                fullscreen={isFullscreen}
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={(id) => editorUi.selectWidget(id)}
                isUploading={editorUi.isUploadingBackground}
                isRatioLocked={editorUi.isSelectedRatioLocked}
                focusedMonitorName={editorUi.focusedMonitorName}
              />
            </main>

            <aside
              className={cx(
                isFullscreen ? styles.inspectorDrawer : styles.inspector,
                isFullscreen &&
                  editorUi.isInspectorOpen &&
                  styles.inspectorDrawerOpen
              )}
            >
              {isFullscreen && (
                <div className={styles.panelDrawerHeader}>
                  <span className={styles.panelDrawerTitle}>
                    {t('layoutEditor.inspectorTitle')}
                  </span>
                  <Tooltip title={t('layoutEditor.hidePanel')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<PanelRightClose size={16} />}
                      onClick={() => editorUi.setInspectorOpen(false)}
                    />
                  </Tooltip>
                </div>
              )}

              <WidgetInspector
                selectedWidgetId={selectedWidgetId}
                isRatioLocked={editorUi.isSelectedRatioLocked}
                onToggleRatioLock={handleToggleRatioLock}
                moveTargetOptions={moveTargetOptions}
                onSelectWidget={(id) => editorUi.selectWidget(id)}
                onSnap={handleSnap}
              />
            </aside>
          </div>
        </div>
      </ConfigProvider>
    );
  }
);
