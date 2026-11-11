import React, { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { resizeBox, snapToGrid } from '@features/layout-editor/resize-geometry';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';
import type { MonitorBounds } from '@shared/contracts/widget-settings';
import {
  resizeDirectionsFor,
  widgetBoxSize,
  widgetFrameStyle,
  type ResizeDirection,
  widgetScaleOf,
} from '@entities/widget/widget-frame';
import { useRendersNothing } from './use-renders-nothing';
import styles from './LayoutCanvas.module.scss';

// Snap distance (overlay px) for centering a widget on the canvas axes.
const SNAP_CENTER_THRESHOLD = 24;

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
// is read from and written to the main store in overlay-space px; screen-space
// pointer deltas are divided by `fit` to convert back to overlay-space. Content
// scaling (--wfs) mirrors the overlay's WidgetContainer.
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

    const isDraggingRef = useRef(false);
    const isResizingRef = useRef(false);

    // Removes whichever document listeners a drag/resize gesture installed. Held
    // in a ref so an unmount mid-gesture can tear them down (the gesture's own
    // mouseup would otherwise never fire).
    const detachListenersRef = useRef<(() => void) | null>(null);

    useEffect(() => () => detachListenersRef.current?.(), []);

    const dragStartRef = useRef({
      mouseX: 0,
      mouseY: 0,
      widgetX: 0,
      widgetY: 0,
    });

    const resizeStartRef = useRef({
      mouseX: 0,
      mouseY: 0,
      widgetW: 0,
      widgetH: 0,
      widgetX: 0,
      widgetY: 0,
      // The box a content-sized widget drew at the press, in layout pixels
      // (`offsetWidth` ignores the canvas zoom).
      drawnW: 0,
      drawnH: 0,
    });

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

    const handleDragMouseDown = useCallback(
      (event: React.MouseEvent) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onSelect(widgetId);

        mainSettings.pushUndo();

        const current = mainSettings.getWidget(widgetId);

        isDraggingRef.current = true;
        dragStartRef.current = {
          mouseX: event.clientX,
          mouseY: event.clientY,
          widgetX: current?.userSettings.x ?? 0,
          widgetY: current?.userSettings.y ?? 0,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isDraggingRef.current) {
            return;
          }

          const dx = (moveEvent.clientX - dragStartRef.current.mouseX) / fit;
          const dy = (moveEvent.clientY - dragStartRef.current.mouseY) / fit;

          let newX = Math.round(dragStartRef.current.widgetX + dx);
          let newY = Math.round(dragStartRef.current.widgetY + dy);

          if (snap) {
            newX = snapToGrid(newX, gridSize);
            newY = snapToGrid(newY, gridSize);

            const centreX = world.x + world.width / 2;
            const centreY = world.y + world.height / 2;

            if (Math.abs(newX + width / 2 - centreX) < SNAP_CENTER_THRESHOLD) {
              newX = Math.round(centreX - width / 2);
            }

            if (Math.abs(newY + height / 2 - centreY) < SNAP_CENTER_THRESHOLD) {
              newY = Math.round(centreY - height / 2);
            }
          }

          mainSettings.updatePosition(widgetId, newX, newY);
        };

        const detach = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          detachListenersRef.current = null;
        };

        const onMouseUp = () => {
          isDraggingRef.current = false;
          detach();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        detachListenersRef.current = detach;
      },
      [
        fit,
        mainSettings,
        onSelect,
        widgetId,
        snap,
        gridSize,
        world,
        width,
        height,
      ]
    );

    const handleResizeMouseDown = useCallback(
      (event: React.MouseEvent, direction: ResizeDirection) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onSelect(widgetId);

        mainSettings.pushUndo();

        const current = mainSettings.getWidget(widgetId);
        const drawnBox = (
          event.currentTarget as HTMLElement
        ).closest<HTMLElement>('[data-widget-id]');

        isResizingRef.current = true;
        resizeStartRef.current = {
          mouseX: event.clientX,
          mouseY: event.clientY,
          widgetW: current?.userSettings.currentWidth ?? designWidth,
          widgetH: current?.userSettings.currentHeight ?? designHeight,
          widgetX: current?.userSettings.x ?? 0,
          widgetY: current?.userSettings.y ?? 0,
          drawnW: drawnBox?.offsetWidth ?? 0,
          drawnH: drawnBox?.offsetHeight ?? 0,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isResizingRef.current) {
            return;
          }

          const dx = (moveEvent.clientX - resizeStartRef.current.mouseX) / fit;
          const dy = (moveEvent.clientY - resizeStartRef.current.mouseY) / fit;

          const start = {
            x: resizeStartRef.current.widgetX,
            y: resizeStartRef.current.widgetY,
            width: resizeStartRef.current.widgetW,
            height: resizeStartRef.current.widgetH,
          };
          const box = resizeBox({
            direction,
            dx,
            dy,
            start,
            drawn: {
              width: resizeStartRef.current.drawnW,
              height: resizeStartRef.current.drawnH,
            },
            design: { width: designWidth, height: designHeight },
            widget: {
              contentSized: widget?.contentSized,
              scaleFromHeight: widget?.scaleFromHeight,
              lockAspectRatio: widget?.lockAspectRatio,
            },
            snapGrid: snap ? gridSize : null,
            keepRatio: moveEvent.shiftKey || isRatioLocked,
          });

          mainSettings.updateSize(widgetId, box.width, box.height);

          if (box.x !== start.x || box.y !== start.y) {
            mainSettings.updatePosition(widgetId, box.x, box.y);
          }
        };

        const detach = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          detachListenersRef.current = null;
        };

        const onMouseUp = () => {
          isResizingRef.current = false;
          detach();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        detachListenersRef.current = detach;
      },
      [
        designHeight,
        designWidth,
        fit,
        mainSettings,
        onSelect,
        widgetId,
        snap,
        gridSize,
        isRatioLocked,
        widget?.lockAspectRatio,
        widget?.scaleFromHeight,
        widget?.contentSized,
      ]
    );

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
          onMouseDown={handleDragMouseDown}
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
                onMouseDown={(event) => handleResizeMouseDown(event, direction)}
              />
            ))}
        </div>
      </div>
    );
  }
);
