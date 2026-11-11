import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Spin } from 'antd';
import { Monitor } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { WidgetIdContext } from '@entities/widget/WidgetIdContext';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { isRemoteMonitor } from '@shared/lib/remote-screen';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { WidgetInstanceScope } from '@widgets/instance-scope/WidgetInstanceScope';
import { componentForWidget } from '@widgets/registry';

import { KeyboardHint } from './KeyboardHint';
import { LayoutCanvasWidget } from './LayoutCanvasWidget';
import { MonitorPlate } from './MonitorPlate';
import { useCanvasKeyboard } from './use-canvas-keyboard';
import { useCanvasView } from './use-canvas-view';
import { usePreviewWorld } from './use-preview-world';
import { useScreenDrag } from './use-screen-drag';
import { useStageBackground } from './use-stage-background';
import styles from './LayoutCanvas.module.scss';

// Letterboxed editor canvas: a fixed target-resolution world scaled to fit the
// available pane (WYSIWYG with the overlay). Each enabled widget is a draggable,
// resizable box writing back into the main store — the single source of truth.
export const LayoutCanvas = observer(() => {
  const liveWidgets = useMainLiveWidgetsStore();
  const layouts = useLayoutsStore();
  const appSettings = useAppSettingsStore();
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');

  const {
    editorShowGrid: showGrid,
    editorSnapToGrid: snapToGrid,
    editorGridSize: gridSize,
  } = appSettings.appSettings;
  const fullscreen = editorUi.isFullscreen;
  const selectedWidgetId = editorUi.selectedWidgetId;
  const monitors = layouts.editingLayout?.monitors ?? [];
  const focusedMonitorName = editorUi.focusedMonitorName;
  const focusedMonitor = focusedMonitorName
    ? monitors.find((monitor) => monitor.name === focusedMonitorName)
    : undefined;

  const previewWorld = usePreviewWorld(editorUi.scenarioId);
  const PreviewProvide = previewWorld.Provide;
  const canvasView = useCanvasView(monitors, focusedMonitor);
  const { paneRef, view, fit } = canvasView;
  const { draggedScreen, startScreenDrag } = useScreenDrag(
    monitors,
    canvasView
  );

  useCanvasKeyboard();

  const backgroundImages = layouts.editingLayout?.backgroundImages;
  // In overview every monitor paints its own image inside its rectangle; the
  // stage itself only carries one when a single monitor fills it.
  const { backgroundSrc, isBackgroundLoading } = useStageBackground(
    focusedMonitor ? backgroundImages?.[focusedMonitor.name] : undefined
  );

  return (
    <PreviewProvide>
      <div
        className={`${styles.pane} ${
          fullscreen ? styles.paneFullscreen : ''
        } ${draggedScreen ? styles.paneDragging : ''}`}
        ref={paneRef}
      >
        {fit > 0 && (
          <div
            className={`${styles.stage} ${
              fullscreen ? styles.stageFullscreen : ''
            } ${draggedScreen ? styles.stageDragging : ''}`}
            style={{
              width: view.width * fit,
              height: view.height * fit,
              backgroundImage: backgroundSrc
                ? `url(${backgroundSrc})`
                : undefined,
            }}
            role="presentation"
            onMouseDown={() => editorUi.selectWidget(null)}
          >
            {/* The canvas shows one monitor at a time; without naming it,
                switching monitors reads as the widgets disappearing. */}
            {!fullscreen && (
              <div className={styles.monitorTag}>
                <Monitor size={11} />
                <b>
                  {focusedMonitor
                    ? focusedMonitor.name
                    : t('layoutCanvas.allMonitors')}
                </b>
                {` · ${view.width}×${view.height}`}
              </div>
            )}

            {/* Screen-space, not inside the scaled world: the alignment grid
                sits between the monitors and the widgets, and a plate drawn
                in the world would paint over it. */}
            {monitors.map((monitor) => (
              <MonitorPlate
                key={monitor.name}
                monitor={monitor}
                image={backgroundImages?.[monitor.name]}
                fit={fit}
                view={view}
                showGrid={showGrid}
                gridSize={gridSize}
                onDragStart={
                  !focusedMonitor && isRemoteMonitor(monitor)
                    ? (event) => startScreenDrag(event, monitor)
                    : undefined
                }
                bounds={
                  draggedScreen?.name === monitor.name
                    ? draggedScreen.bounds
                    : undefined
                }
                isBlocked={
                  draggedScreen?.name === monitor.name &&
                  draggedScreen.isBlocked
                }
              />
            ))}

            {(isBackgroundLoading || editorUi.isUploadingBackground) && (
              <div className={styles.backgroundLoader}>
                <Spin size="large" tip={t('layoutCanvas.loadingBackground')} />
              </div>
            )}

            <div
              className={styles.world}
              style={{
                width: view.width,
                height: view.height,
                transform: `scale(${fit}) translate(${-view.x}px, ${-view.y}px)`,
              }}
            >
              {liveWidgets.enabledWidgetIds.map((id) => {
                const widget = liveWidgets.getWidget(id);
                const Widget = widget
                  ? componentForWidget(widget.type)
                  : undefined;

                if (!widget || !Widget) {
                  return null;
                }

                const isSelected = selectedWidgetId === id;

                return (
                  <LayoutCanvasWidget
                    key={id}
                    widgetId={id}
                    fit={fit}
                    mainSettings={liveWidgets}
                    isSelected={isSelected}
                    isRatioLocked={isSelected && editorUi.isSelectedRatioLocked}
                    snap={snapToGrid}
                    gridSize={gridSize}
                    world={view}
                    onSelect={(id) => editorUi.selectWidget(id)}
                  >
                    <ErrorBoundary>
                      <WidgetIdContext.Provider value={id}>
                        <WidgetInstanceScope type={widget.type} instanceId={id}>
                          <Widget />
                        </WidgetInstanceScope>
                      </WidgetIdContext.Provider>
                    </ErrorBoundary>
                  </LayoutCanvasWidget>
                );
              })}
            </div>
          </div>
        )}

        {selectedWidgetId && <KeyboardHint />}
      </div>
    </PreviewProvide>
  );
});
