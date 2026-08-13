import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Spin } from 'antd';
import {
  SquareArrowUp,
  SquareArrowDown,
  SquareArrowLeft,
  SquareArrowRight,
  Monitor,
} from 'lucide-react';
import { RootStore } from '@store/root-store';
import {
  RootStoreContext,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { componentForWidget } from '@ui/widgets/registry';
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
import { LayoutCanvasWidget } from './LayoutCanvasWidget';
import styles from './LayoutCanvas.module.scss';

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
  previewStore.widgetSettings.applySettingsSync(
    source.map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }))
  );
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
  }: {
    monitor: LayoutMonitor;
    image?: string;
    fit: number;
    view: MonitorBounds;
    showGrid: boolean;
    gridSize: number;
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

    return (
      <div
        className={styles.monitorPlate}
        style={{
          left: (monitor.bounds.x - view.x) * fit,
          top: (monitor.bounds.y - view.y) * fit,
          width: monitor.bounds.width * fit,
          height: monitor.bounds.height * fit,
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
    const monitors = widgetSettings.activeLayout?.monitors ?? [];
    const focusedMonitor = focusedMonitorName
      ? monitors.find((monitor) => monitor.name === focusedMonitorName)
      : undefined;
    const { t } = useTranslation('main-app');
    const previewStore = useMemo(() => new RootStore({ skipInit: true }), []);

    const paneRef = useRef<HTMLDivElement | null>(null);
    const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });

    useEffect(() => () => previewStore.dispose(), [previewStore]);

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
    const view = focusedMonitor ? focusedMonitor.bounds : desktop;

    const fit =
      paneSize.width > 0 &&
      paneSize.height > 0 &&
      view.width > 0 &&
      view.height > 0
        ? Math.min(paneSize.width / view.width, paneSize.height / view.height)
        : 0;

    const scaledWidth = view.width * fit;
    const scaledHeight = view.height * fit;

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
          className={`${styles.pane} ${fullscreen ? styles.paneFullscreen : ''}`}
          ref={paneRef}
        >
          {fit > 0 && (
            <div
              className={`${styles.stage} ${
                fullscreen ? styles.stageFullscreen : ''
              }`}
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
                  const Widget = componentForWidget(id);

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
