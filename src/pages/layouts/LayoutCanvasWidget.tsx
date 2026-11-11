import { useRef, type ReactNode } from 'react';
import {
  useWidgetGestures,
  type GeometryWriter,
} from '@features/layout-editor/use-widget-gestures';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';
import type { MonitorBounds } from '@shared/contracts/widget-settings';
import {
  resizeDirectionsFor,
  widgetBoxSize,
  widgetFrameStyle,
  widgetScaleOf,
} from '@entities/widget/widget-frame';
import { useRendersNothing } from './use-renders-nothing';
import styles from './LayoutCanvas.module.scss';

interface LayoutCanvasWidgetProps {
  widgetId: string;
  fit: number;
  mainSettings: LiveWidgetsStore;
  isSelected: boolean;
  snap: boolean;
  gridSize: number;
  world: MonitorBounds;
  onSelect: (id: string) => void;
  isRatioLocked?: boolean;
  children: ReactNode;
}

// One positioned, draggable, resizable widget box on the editor canvas. Geometry
// is read from and written to the main store in overlay-space px; the canvas is
// drawn at `fit`, so the gestures divide pointer travel by it. Content scaling
// (--wfs) mirrors the overlay's WidgetContainer.
export const LayoutCanvasWidget = observer(
  ({
    widgetId,
    fit,
    mainSettings,
    isSelected,
    snap,
    gridSize,
    world,
    onSelect,
    isRatioLocked = false,
    children,
  }: LayoutCanvasWidgetProps) => {
    const widget = mainSettings.getWidget(widgetId);
    const { t } = useTranslation('main-app');

    // A widget with nothing to show in the preview scenario still has to be
    // somewhere the user can see, grab and move.
    const innerRef = useRef<HTMLDivElement | null>(null);
    const rendersNothing = useRendersNothing(innerRef);

    // The editor writes main's store directly; a resize moves the box only
    // when a top or left edge moved it.
    const geometryWriter: GeometryWriter = {
      move: (id, x, y) => mainSettings.updatePosition(id, x, y),
      resize: (id, box, start) => {
        mainSettings.updateSize(id, box.width, box.height);

        if (box.x !== start.x || box.y !== start.y) {
          mainSettings.updatePosition(id, box.x, box.y);
        }
      },
      end: () => {},
    };

    const { onDragMouseDown, onResizeMouseDown } = useWidgetGestures(
      widgetId,
      geometryWriter,
      {
        widgets: mainSettings,
        viewScale: fit,
        enabled: true,
        onGestureStart: () => {
          onSelect(widgetId);
          mainSettings.pushUndo();
        },
        snap: snap ? { gridSize, area: world } : null,
        keepsRatio: (moveEvent) => moveEvent.shiftKey || isRatioLocked,
      }
    );

    const x = widget?.userSettings.x ?? 100;
    const y = widget?.userSettings.y ?? 100;
    const width = widget?.userSettings.currentWidth ?? 200;
    const height = widget?.userSettings.currentHeight ?? 200;

    const designWidth = widget?.designWidth ?? width;
    const designHeight = widget?.designHeight ?? height;
    const autoHeight = widget?.autoHeight ?? false;
    const contentSized = widget?.contentSized ?? false;
    const overflowVisible = widget?.overflowVisible ?? false;
    const transparentContainer = widget?.transparentContainer ?? false;

    const scaleFromHeight = widget?.scaleFromHeight ?? false;

    const widgetScale = widgetScaleOf({
      scaleFromHeight,
      width,
      height,
      designWidth,
      designHeight,
    });

    const frameStyle = widgetFrameStyle({
      widgetType: widget ? widget.type : widgetId,
      userSettings: widget?.userSettings ?? {},
      widgetScale,
      transparentContainer,
      autoHeight,
      contentSized,
    });

    const frameBorderRadius = frameStyle.borderRadius;

    const resizeDirections = resizeDirectionsFor({
      autoHeight,
      contentSized,
      lockAspectRatio: widget?.lockAspectRatio,
      scaleFromHeight,
    });

    return (
      <div
        className={styles.widgetBox}
        data-widget-id={widgetId}
        style={{
          left: x,
          top: y,
          ...widgetBoxSize({ width, height, autoHeight, contentSized }),
        }}
      >
        <div
          role="presentation"
          className={styles.dragWrapper}
          onMouseDown={onDragMouseDown}
        >
          <div
            ref={innerRef}
            className={`${styles.widgetInner} ${
              overflowVisible ? styles.overflowVisible : ''
            } ${rendersNothing ? styles.widgetInnerEmpty : ''}`}
            style={frameStyle}
          >
            {children}
          </div>

          {rendersNothing && (
            <div className={styles.emptyWidget} style={{ height }}>
              <span className={styles.emptyWidgetLabel}>{widget?.label}</span>
              <span className={styles.emptyWidgetHint}>
                {t('layoutCanvas.nothingToShow')}
              </span>
            </div>
          )}

          {isSelected && (
            <div
              role="presentation"
              className={styles.selectionOutline}
              style={{ borderRadius: frameBorderRadius }}
            />
          )}

          {isSelected &&
            resizeDirections.map((direction) => (
              <div
                key={direction}
                role="presentation"
                className={`${styles.resizeHandle} ${
                  styles[`resizeHandle${direction.toUpperCase()}`]
                }`}
                onMouseDown={(event) => onResizeMouseDown(event, direction)}
              />
            ))}
        </div>
      </div>
    );
  }
);
