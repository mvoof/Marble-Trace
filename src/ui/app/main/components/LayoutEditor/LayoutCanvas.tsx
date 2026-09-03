import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { reaction, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Spin } from 'antd';
import {
  SquareArrowUp,
  SquareArrowDown,
  SquareArrowLeft,
  SquareArrowRight,
  Monitor,
  GripHorizontal,
} from 'lucide-react';
import { RootStore } from '@store/root-store';
import {
  RootStoreContext,
  useSessionStore,
  useTrackMapWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { componentForWidget } from '@ui/widgets/registry';
import { widgetTypeOf } from '@utils/widget-instance';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import { ErrorBoundary } from '@ui/shared/ErrorBoundary';
import {
  seedScenario,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { resolveBackgroundSrc } from '@store/settings/layout-background';
import { monitorsBounds } from '@store/settings/virtual-desktop';
import { seedInputHistory } from '@store/preview/preview-animator';
import type {
  LayoutMonitor,
  MonitorBounds,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import {
  boundsOverlap,
  clearOfMonitors,
  isRemoteMonitor,
} from '@utils/remote-screen';
import { LayoutCanvasWidget } from './LayoutCanvasWidget';
import styles from './LayoutCanvas.module.scss';

/**
 * Keeps the editor's sample map and the real one on the same angle.
 *
 * The editor draws a synthetic track, so rotating it there has to be filed
 * under the track the user is actually on — the preview store owns no track of
 * its own and never writes to disk. The reverse direction matters just as much:
 * a map turned in an overlay must already look turned when the editor opens.
 */
const useTrackRotationBridge = (previewStore: RootStore) => {
  const trackMapWidget = useTrackMapWidgetStore();
  const sessionStore = useSessionStore();

  useLayoutEffect(() => {
    const previewMap = previewStore.trackMapWidget;

    runInAction(() =>
      previewMap.setTrackRotation(trackMapWidget.trackRotation)
    );

    const disposers = [
      reaction(
        () => previewMap.trackRotation,
        (rotation) => {
          if (rotation === trackMapWidget.trackRotation) {
            return;
          }

          const { sessionInfo } = sessionStore;
          const trackId =
            sessionInfo && sessionInfo.trackId >= 0
              ? String(sessionInfo.trackId)
              : '';

          trackMapWidget.rotateTo(trackId, rotation);
        }
      ),
      reaction(
        () => trackMapWidget.trackRotation,
        (rotation) => {
          runInAction(() => previewMap.setTrackRotation(rotation));
        }
      ),
    ];

    return () => disposers.forEach((dispose) => dispose());
  }, [previewStore, sessionStore, trackMapWidget]);
};

interface LayoutCanvasProps {
  scenarioId?: string;
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  fullscreen?: boolean;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
  isUploading?: boolean;
  isRatioLocked?: boolean;
  /** Monitor filling the canvas, or null to view the whole desktop at once. */
  focusedMonitorName?: string | null;
}

// Mirror the full widget set from the main store into the isolated preview store
// so every widget on the canvas renders against sample telemetry while reflecting
// live edits. Positions/sizes are read from the main store directly by the
// canvas; only content-affecting settings need mirroring here.
const mirrorAllWidgets = (
  source: WidgetDefaultConfig[],
  previewStore: RootStore
) => {
  const mirrored = source.map((widget) => ({
    ...widget,
    userSettings: { ...widget.userSettings },
  }));

  // The preview world starts as the shipped catalog — one record per widget —
  // so a layout holding a copy has records it has never heard of. `syncWidgetSet`
  // reinstalls the list whenever the set of records changes, and patches it
  // field by field the rest of the time.
  previewStore.widgetSettings.syncWidgetSet(mirrored);
};

// One screen of the layout, drawn in desktop coordinates behind the widgets.
// Each monitor carries its own background image — a cockpit shot for the main
// screen, whatever sits on the others.
const MonitorPlate = observer(
  ({
    monitor,
    image,
    fit,
    view,
    showGrid,
    gridSize,
    onDragStart,
    bounds,
    isBlocked = false,
  }: {
    monitor: LayoutMonitor;
    image?: string;
    fit: number;
    view: MonitorBounds;
    showGrid: boolean;
    gridSize: number;
    /** Present only for screens the user may re-park — remote ones in overview. */
    onDragStart?: (event: ReactMouseEvent) => void;
    /** Where to draw the plate while it is being dragged, ahead of the store. */
    bounds?: MonitorBounds;
    /** Drawn as rejected: dropping here would land on another screen. */
    isBlocked?: boolean;
  }) => {
    const [src, setSrc] = useState<string | undefined>();

    useEffect(() => {
      let active = true;

      if (!image) {
        setSrc(undefined);

        return;
      }

      resolveBackgroundSrc(image)
        .then((resolved) => {
          if (active) setSrc(resolved);
        })
        .catch((error: unknown) =>
          console.error('Failed to resolve background image:', error)
        );

      return () => {
        active = false;
      };
    }, [image]);

    const drawn = bounds ?? monitor.bounds;

    return (
      <div
        className={`${styles.monitorPlate} ${
          isBlocked ? styles.monitorPlateBlocked : ''
        }`}
        style={{
          left: (drawn.x - view.x) * fit,
          top: (drawn.y - view.y) * fit,
          width: drawn.width * fit,
          height: drawn.height * fit,
          backgroundImage: src ? `url(${src})` : undefined,
        }}
      >
        {showGrid && (
          <div
            className={styles.grid}
            aria-hidden="true"
            style={{
              backgroundSize: `${gridSize * fit}px ${gridSize * fit}px`,
            }}
          >
            <div className={styles.axisVertical} />
            <div className={styles.axisHorizontal} />
          </div>
        )}

        {/* The widget layer covers the plate, so a remote screen is moved by a
            grab bar drawn above it rather than by its whole surface — which
            also keeps a click on empty screen area clearing the selection. */}
        {onDragStart && (
          <div
            className={styles.plateHandle}
            role="presentation"
            onMouseDown={onDragStart}
          >
            <GripHorizontal size={11} />
            <span className={styles.plateHandleLabel}>{monitor.name}</span>
          </div>
        )}
      </div>
    );
  }
);

// Letterboxed editor canvas: a fixed target-resolution world scaled to fit the
// available pane (WYSIWYG with the overlay). Each enabled widget is a draggable,
// resizable box writing back into the main store — the single source of truth.
export const LayoutCanvas = observer(
  ({
    scenarioId = DEFAULT_PREVIEW_SCENARIO_ID,
    showGrid = false,
    snapToGrid = false,
    gridSize = 20,
    fullscreen = false,
    selectedWidgetId,
    onSelectWidget,
    isUploading = false,
    isRatioLocked = false,
    focusedMonitorName = null,
  }: LayoutCanvasProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const units = useUnitsStore();
    const monitors = widgetSettings.activeLayout?.monitors ?? [];
    const focusedMonitor = focusedMonitorName
      ? monitors.find((monitor) => monitor.name === focusedMonitorName)
      : undefined;
    const { t } = useTranslation('main-app');
    const previewStore = useMemo(() => new RootStore({ skipInit: true }), []);

    const paneRef = useRef<HTMLDivElement | null>(null);
    const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
    const [frozenView, setFrozenView] = useState<MonitorBounds | null>(null);
    const [draggedScreen, setDraggedScreen] = useState<{
      name: string;
      bounds: MonitorBounds;
      isBlocked: boolean;
    } | null>(null);

    useEffect(() => () => previewStore.dispose(), [previewStore]);

    // The editor is the overlay in drag mode, seen from the main window, so the
    // widgets show the same in-place controls here — the track map's rotation
    // buttons among them.
    useLayoutEffect(() => {
      runInAction(() => {
        previewStore.appSettings.dragMode = true;
      });
    }, [previewStore]);

    useTrackRotationBridge(previewStore);

    // The preview store carries its own units; mirror the app's, or the editor
    // shows metres while the overlay shows feet.
    useLayoutEffect(() => {
      previewStore.units.setSystem(units.unitSystem);
    }, [previewStore, units.unitSystem]);

    useLayoutEffect(() => {
      seedScenario(previewStore, scenarioId);
    }, [previewStore, scenarioId]);

    useEffect(() => {
      seedInputHistory(previewStore);
    }, [previewStore, scenarioId]);

    useLayoutEffect(() => {
      mirrorAllWidgets(widgetSettings.allWidgets, previewStore);

      return reaction(
        () => [widgetSettings.changeToken, widgetSettings.syncToken],
        () => mirrorAllWidgets(widgetSettings.allWidgets, previewStore)
      );
    }, [previewStore, widgetSettings]);

    useLayoutEffect(() => {
      const pane = paneRef.current;

      if (!pane) {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];

        setPaneSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });

      observer.observe(pane);

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const active = document.activeElement;

        if (active) {
          const tagName = active.tagName.toLowerCase();

          if (
            tagName === 'input' ||
            tagName === 'textarea' ||
            active.getAttribute('contenteditable') === 'true'
          ) {
            return;
          }
        }

        let handled = false;

        if (
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'z'
        ) {
          event.preventDefault();
          widgetSettings.undo();
          handled = true;
        } else if (
          (event.ctrlKey || event.metaKey) &&
          (event.key.toLowerCase() === 'y' ||
            (event.shiftKey && event.key.toLowerCase() === 'z'))
        ) {
          event.preventDefault();
          widgetSettings.redo();
          handled = true;
        }

        if (handled) return;

        if (!selectedWidgetId) return;

        const widget = widgetSettings.getWidget(selectedWidgetId);

        if (!widget) return;

        const currentX = widget.userSettings.x;
        const currentY = widget.userSettings.y;

        let step = snapToGrid ? gridSize : 1;

        if (event.shiftKey) {
          step = snapToGrid ? gridSize * 5 : 10;
        }

        const snappedX = snapToGrid
          ? Math.round(currentX / gridSize) * gridSize
          : currentX;
        const snappedY = snapToGrid
          ? Math.round(currentY / gridSize) * gridSize
          : currentY;

        let newX = currentX;
        let newY = currentY;

        switch (event.key) {
          case 'ArrowUp':
            newY = snappedY - step;
            handled = true;
            break;
          case 'ArrowDown':
            newY = snappedY + step;
            handled = true;
            break;
          case 'ArrowLeft':
            newX = snappedX - step;
            handled = true;
            break;
          case 'ArrowRight':
            newX = snappedX + step;
            handled = true;
            break;
          case 'Delete':
          case 'Backspace':
            widgetSettings.setWidgetEnabled(selectedWidgetId, false);
            onSelectWidget('');
            handled = true;
            break;
          case 'Escape':
            onSelectWidget('');
            handled = true;
            break;
          default:
            break;
        }

        if (handled) {
          event.preventDefault();

          if (newX !== currentX || newY !== currentY) {
            widgetSettings.pushUndo();
            widgetSettings.updatePosition(selectedWidgetId, newX, newY);
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [
      selectedWidgetId,
      widgetSettings,
      snapToGrid,
      gridSize,
      onSelectWidget,
    ]);

    // Overview fits every monitor of the layout at once — the only way to drag
    // a widget between screens. Focusing one zooms to it, because three or more
    // screens side by side leave widgets too small to grab.
    const desktop = monitorsBounds(monitors);
    // The overview zoom follows the desktop rectangle, which a screen being
    // dragged is part of — recomputing it mid-drag would rescale the canvas
    // under the cursor. The box is frozen for the duration and catches up on
    // drop.
    const view = focusedMonitor
      ? focusedMonitor.bounds
      : (frozenView ?? desktop);

    const fit =
      paneSize.width > 0 &&
      paneSize.height > 0 &&
      view.width > 0 &&
      view.height > 0
        ? Math.min(paneSize.width / view.width, paneSize.height / view.height)
        : 0;

    const scaledWidth = view.width * fit;
    const scaledHeight = view.height * fit;

    // Remote screens are the only rectangles the user places by hand: a real
    // monitor's position is dictated by Windows.
    const handleScreenDragStart = (
      event: ReactMouseEvent,
      monitor: LayoutMonitor
    ) => {
      if (event.button !== 0 || fit <= 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // The zoom must not change while a screen is in hand: the plate is drawn
      // at the stage's scale, so rescaling on grab slides it out from under the
      // pointer. The box is frozen exactly as it was, and room outside it comes
      // from the stage dropping its clipping for the duration instead.
      setFrozenView(desktop);

      const startMouseX = event.clientX;
      const startMouseY = event.clientY;
      const startX = monitor.bounds.x;
      const startY = monitor.bounds.y;

      const others = monitors
        .filter((candidate) => candidate.name !== monitor.name)
        .map((candidate) => ({ ...candidate.bounds }));

      // The drag writes to local state only. Committing every move would have
      // to refuse the ones that overlap, and a screen cannot reach the far side
      // of a monitor without crossing it — the drag would stall at the edge.
      let dropped = { ...monitor.bounds };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startMouseX) / fit;
        const dy = (moveEvent.clientY - startMouseY) / fit;

        let nextX = Math.round(startX + dx);
        let nextY = Math.round(startY + dy);

        if (snapToGrid) {
          nextX = Math.round(nextX / gridSize) * gridSize;
          nextY = Math.round(nextY / gridSize) * gridSize;
        }

        dropped = { ...monitor.bounds, x: nextX, y: nextY };

        setDraggedScreen({
          name: monitor.name,
          bounds: dropped,
          isBlocked: others.some((other) => boundsOverlap(other, dropped)),
        });
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Landing on another screen is resolved by sliding out of it the short
        // way, so a drop half over a monitor reads as "put it beside this one"
        // rather than as nothing happening.
        const landed = clearOfMonitors(dropped, others);

        widgetSettings.moveRemoteScreen(monitor.name, landed.x, landed.y);
        setDraggedScreen(null);
        setFrozenView(null);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const backgroundImages = widgetSettings.activeLayout?.backgroundImages;
    // In overview every monitor paints its own image inside its rectangle; the
    // stage itself only carries one when a single monitor fills it.
    const rawBackground = focusedMonitor
      ? backgroundImages?.[focusedMonitor.name]
      : undefined;
    const [backgroundSrc, setBackgroundSrc] = useState<string | undefined>();
    const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);

    // Mark loading synchronously before paint so there is no visible gap
    // between the upload spinner disappearing and the load spinner appearing.
    useLayoutEffect(() => {
      if (rawBackground) {
        setIsBackgroundLoading(true);
      }
    }, [rawBackground]);

    useEffect(() => {
      let isEffectActive = true;

      if (!rawBackground) {
        setBackgroundSrc(undefined);
        setIsBackgroundLoading(false);

        return;
      }

      void resolveBackgroundSrc(rawBackground)
        .then((resolvedSrc) => {
          if (!isEffectActive) {
            return;
          }

          if (!resolvedSrc) {
            setBackgroundSrc(undefined);
            setIsBackgroundLoading(false);

            return;
          }

          const imagePreloader = new Image();
          imagePreloader.src = resolvedSrc;

          imagePreloader.onload = () => {
            if (isEffectActive) {
              setBackgroundSrc(resolvedSrc);
              setIsBackgroundLoading(false);
            }
          };

          imagePreloader.onerror = (preloadError) => {
            console.error('Failed to preload background image:', preloadError);

            if (isEffectActive) {
              setBackgroundSrc(resolvedSrc);
              setIsBackgroundLoading(false);
            }
          };
        })
        .catch((resolveError) => {
          console.error('Failed to resolve background source:', resolveError);

          if (isEffectActive) {
            setIsBackgroundLoading(false);
          }
        });

      return () => {
        isEffectActive = false;
      };
    }, [rawBackground]);

    return (
      <RootStoreContext.Provider value={previewStore}>
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
                width: scaledWidth,
                height: scaledHeight,
                backgroundImage: backgroundSrc
                  ? `url(${backgroundSrc})`
                  : undefined,
              }}
              role="presentation"
              onMouseDown={() => onSelectWidget('')}
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
                      ? (event) => handleScreenDragStart(event, monitor)
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

              {(isBackgroundLoading || isUploading) && (
                <div className={styles.backgroundLoader}>
                  <Spin
                    size="large"
                    tip={t('layoutCanvas.loadingBackground')}
                  />
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
                {widgetSettings.enabledWidgetIds.map((id) => {
                  const widget = widgetSettings.getWidget(id);
                  const Widget = widget
                    ? componentForWidget(widgetTypeOf(widget))
                    : undefined;

                  if (!Widget) {
                    return null;
                  }

                  return (
                    <LayoutCanvasWidget
                      key={id}
                      widgetId={id}
                      fit={fit}
                      mainSettings={widgetSettings}
                      isSelected={selectedWidgetId === id}
                      isRatioLocked={selectedWidgetId === id && isRatioLocked}
                      snap={snapToGrid}
                      gridSize={gridSize}
                      world={view}
                      onSelect={onSelectWidget}
                    >
                      <ErrorBoundary>
                        <WidgetIdContext.Provider value={id}>
                          <Widget />
                        </WidgetIdContext.Provider>
                      </ErrorBoundary>
                    </LayoutCanvasWidget>
                  );
                })}
              </div>
            </div>
          )}

          {selectedWidgetId && (
            <div className={styles.keyboardHint}>
              <div className={styles.arrowCluster}>
                <SquareArrowUp size={16} className={styles.arrowKey} />
                <div className={styles.arrowRow}>
                  <SquareArrowLeft size={16} className={styles.arrowKey} />
                  <SquareArrowDown size={16} className={styles.arrowKey} />
                  <SquareArrowRight size={16} className={styles.arrowKey} />
                </div>
              </div>
              <span className={styles.keyboardHintLabel}>
                {t('layoutCanvas.move')}
              </span>
              <span className={styles.keyboardHintSep}>·</span>
              <kbd className={styles.kbd}>Shift</kbd>
              <span className={styles.keyboardHintLabel}>
                {t('layoutCanvas.stepSize', {
                  size: snapToGrid
                    ? `${gridSize * 5}px`
                    : t('layoutCanvas.large'),
                })}
              </span>
              <span className={styles.keyboardHintSep}>·</span>
              <kbd className={styles.kbd}>Del</kbd>
              <span className={styles.keyboardHintLabel}>
                {t('layoutCanvas.remove')}
              </span>
            </div>
          )}
        </div>
      </RootStoreContext.Provider>
    );
  }
);
