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
} from 'lucide-react';
import { RootStore } from '@store/root-store';
import {
  RootStoreContext,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { WIDGET_BY_ID } from '@store/widget-defaults';
import { WidgetIdContext } from '@app/overlay/components/WidgetContainer/WidgetIdContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import {
  seedScenario,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { resolveBackgroundSrc } from '@utils/widget/layout-background';
import { seedInputHistory } from '@store/preview/preview-animator';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
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
  }: LayoutCanvasProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');
    const previewStore = useMemo(() => new RootStore({ skipInit: true }), []);

    const paneRef = useRef<HTMLDivElement | null>(null);
    const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });

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

    const targetResolution = widgetSettings.overlayResolution;

    const fit =
      paneSize.width > 0 &&
      paneSize.height > 0 &&
      targetResolution.width > 0 &&
      targetResolution.height > 0
        ? Math.min(
            paneSize.width / targetResolution.width,
            paneSize.height / targetResolution.height
          )
        : 0;

    const scaledWidth = targetResolution.width * fit;
    const scaledHeight = targetResolution.height * fit;

    const rawBackground = widgetSettings.activeLayout?.backgroundImage;
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
              {(isBackgroundLoading || isUploading) && (
                <div className={styles.backgroundLoader}>
                  <Spin
                    size="large"
                    tip={t('layoutCanvas.loadingBackground')}
                  />
                </div>
              )}
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

              <div
                className={styles.world}
                style={{
                  width: targetResolution.width,
                  height: targetResolution.height,
                  transform: `scale(${fit})`,
                }}
              >
                {widgetSettings.enabledWidgetIds.map((id) => {
                  const config = WIDGET_BY_ID.get(id);

                  if (!config) {
                    return null;
                  }

                  const Widget = config.component;

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
                      worldWidth={targetResolution.width}
                      worldHeight={targetResolution.height}
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
