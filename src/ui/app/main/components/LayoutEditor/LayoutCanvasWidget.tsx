import React, { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { WidgetSettingsStore } from '@store/settings/widget-settings.store';
import type { MonitorBounds } from '@/types/widget-settings';
import { widgetFrameBorderRadius } from '@ui/app/widget-frame';
import { withAlphaFactor } from '@utils/colors';
import styles from './LayoutCanvas.module.scss';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const ALL_DIRECTIONS: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];
const HORIZONTAL_DIRECTIONS: ResizeDirection[] = ['e', 'w'];

// Aspect-locked widgets keep the corners so they can be scaled up as a whole.
const LOCKED_RATIO_DIRECTIONS: ResizeDirection[] = [
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];

// Snap distance (overlay px) for centering a widget on the canvas axes.
const SNAP_CENTER_THRESHOLD = 24;

const snapToGrid = (value: number, gridSize: number) =>
  Math.round(value / gridSize) * gridSize;

interface LayoutCanvasWidgetProps {
  widgetId: string;
  fit: number;
  mainSettings: WidgetSettingsStore;
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
    });

    const x = widget?.userSettings.x ?? 100;
    const y = widget?.userSettings.y ?? 100;
    const width = widget?.userSettings.currentWidth ?? 200;
    const height = widget?.userSettings.currentHeight ?? 200;

    const designWidth = widget?.designWidth ?? width;
    const designHeight = widget?.designHeight ?? height;
    const autoHeight = widget?.autoHeight ?? false;
    const overflowVisible = widget?.overflowVisible ?? false;
    const transparentContainer = widget?.transparentContainer ?? false;

    const scaleFromHeight = widget?.scaleFromHeight ?? false;

    const widgetScale = scaleFromHeight
      ? height / designHeight
      : width / designWidth;

    const fontScale = widget?.userSettings.fontScale ?? 1;

    const backgroundColor = withAlphaFactor(
      widget?.userSettings.backgroundColor ?? 'rgba(21, 22, 26, 0.8)',
      widget?.userSettings.backgroundOpacity ?? 1
    );
    const borderColor =
      widget?.userSettings.borderColor ?? 'rgba(255, 255, 255, 0.1)';
    const background = transparentContainer ? 'transparent' : backgroundColor;
    const containerBorderColor = transparentContainer
      ? 'transparent'
      : borderColor;

    const frameBorderRadius = widgetFrameBorderRadius(
      widgetId,
      (widget?.userSettings ?? {}) as unknown as Record<string, unknown>
    );

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

        isResizingRef.current = true;
        resizeStartRef.current = {
          mouseX: event.clientX,
          mouseY: event.clientY,
          widgetW: current?.userSettings.currentWidth ?? designWidth,
          widgetH: current?.userSettings.currentHeight ?? designHeight,
          widgetX: current?.userSettings.x ?? 0,
          widgetY: current?.userSettings.y ?? 0,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
          if (!isResizingRef.current) {
            return;
          }

          const dx = (moveEvent.clientX - resizeStartRef.current.mouseX) / fit;
          const dy = (moveEvent.clientY - resizeStartRef.current.mouseY) / fit;

          const minW = Math.max(20, Math.round(designWidth * 0.2));
          const minH = Math.max(20, Math.round(designHeight * 0.2));

          const startW = resizeStartRef.current.widgetW;
          const startH = resizeStartRef.current.widgetH;
          const startX = resizeStartRef.current.widgetX;
          const startY = resizeStartRef.current.widgetY;

          let newW = startW;
          let newH = startH;
          let newX = startX;
          let newY = startY;

          if (direction.includes('e')) {
            newW = Math.max(minW, Math.round(startW + dx));
          }

          if (direction.includes('w')) {
            newW = Math.max(minW, Math.round(startW - dx));
            newX = Math.round(startX + startW - newW);
          }

          if (direction.includes('s')) {
            newH = Math.max(minH, Math.round(startH + dy));
          }

          if (direction.includes('n')) {
            newH = Math.max(minH, Math.round(startH - dy));
            newY = Math.round(startY + startH - newH);
          }

          if (snap) {
            newW = Math.max(minW, snapToGrid(newW, gridSize));
            newH = Math.max(minH, snapToGrid(newH, gridSize));

            if (direction.includes('w')) {
              newX = Math.round(startX + startW - newW);
            }

            if (direction.includes('n')) {
              newY = Math.round(startY + startH - newH);
            }
          }

          if (widget?.scaleFromHeight) {
            // e/w only stretches the widget (its scale comes from the
            // unchanged height); corners rescale it keeping the current shape.
            const isCorner = direction.length === 2;

            if (isCorner && startW > 0) {
              newH = Math.max(minH, Math.round(newW * (startH / startW)));

              if (direction.includes('n')) {
                newY = Math.round(startY + startH - newH);
              }
            }
          } else if (widget?.lockAspectRatio) {
            // Only e/w and corner handles are offered for these widgets (see
            // resizeDirections below) — height always tracks the design
            // aspect ratio, mirroring the overlay's WidgetContainer.
            newH = Math.max(
              minH,
              Math.round(newW * (designHeight / designWidth))
            );

            if (direction.includes('n')) {
              newY = Math.round(startY + startH - newH);
            }
          } else {
            const shouldLockRatio = moveEvent.shiftKey || isRatioLocked;

            if (shouldLockRatio && startW > 0 && startH > 0) {
              const aspect = startW / startH;

              if (direction === 'e' || direction === 'w') {
                newH = Math.max(minH, Math.round(newW / aspect));
              } else if (direction === 'n' || direction === 's') {
                newW = Math.max(minW, Math.round(newH * aspect));
              } else {
                newH = Math.max(minH, Math.round(newW / aspect));
              }

              if (direction.includes('w')) {
                newX = Math.round(startX + startW - newW);
              }

              if (direction.includes('n')) {
                newY = Math.round(startY + startH - newH);
              }
            }
          }

          mainSettings.updateSize(widgetId, newW, newH);

          if (newX !== startX || newY !== startY) {
            mainSettings.updatePosition(widgetId, newX, newY);
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
      ]
    );

    const resizeDirections = autoHeight
      ? HORIZONTAL_DIRECTIONS
      : widget?.lockAspectRatio || scaleFromHeight
        ? LOCKED_RATIO_DIRECTIONS
        : ALL_DIRECTIONS;

    return (
      <div
        className={styles.widgetBox}
        data-widget-id={widgetId}
        style={{
          left: x,
          top: y,
          width,
          height: autoHeight ? 'auto' : height,
        }}
      >
        <div
          role="presentation"
          className={styles.dragWrapper}
          onMouseDown={handleDragMouseDown}
        >
          <div
            className={`${styles.widgetInner} ${
              overflowVisible ? styles.overflowVisible : ''
            }`}
            style={
              {
                ...(autoHeight ? { height: 'auto' } : undefined),
                background,
                borderColor: containerBorderColor,
                borderWidth: transparentContainer ? 0 : undefined,
                borderRadius: frameBorderRadius,
                ['--wfs']: widgetScale,
                ['--font-scale']: fontScale,
                ['--widget-bg']: backgroundColor,
                ['--widget-border']: borderColor,
              } as React.CSSProperties
            }
          >
            {children}
          </div>

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
