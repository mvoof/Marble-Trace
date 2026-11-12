import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import type { ResizeDirection } from '@entities/widget/widget-frame';
import type {
  BaseUserSettings,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

import {
  dragPosition,
  resizeBox,
  type DragSnap,
  type WidgetBox,
} from './resize-geometry';

/** The size a widget box draws at before the store has the widget. */
const FALLBACK_SIZE_PX = 200;

/**
 * Where a gesture's geometry goes: the overlay sends it to main as commands,
 * the editor writes it to main's store.
 */
export interface GeometryWriter {
  move: (widgetId: string, x: number, y: number) => void;
  /** `start` is the stored box at the press. */
  resize: (widgetId: string, box: WidgetBox, start: WidgetBox) => void;
  /** The release, or the box unmounting mid-gesture. */
  end: (widgetId: string) => void;
}

type GestureWidget = Pick<
  WidgetDefaultConfig,
  | 'designWidth'
  | 'designHeight'
  | 'contentSized'
  | 'scaleFromHeight'
  | 'lockAspectRatio'
> & {
  userSettings: Pick<
    BaseUserSettings,
    'x' | 'y' | 'currentWidth' | 'currentHeight'
  >;
};

export interface WidgetGestureOptions {
  /** Where the widget's geometry is read at the press. */
  widgets: { getWidget: (id: string) => GestureWidget | undefined };
  /** Screen px per layout px: the editor's canvas zoom, 1 on the overlay. */
  viewScale: number;
  /** Whether a press starts a gesture: the overlay's drag mode. */
  enabled: boolean;
  /** Runs at the press, before the start is read: the editor selects the widget and takes an undo step. */
  onGestureStart?: () => void;
  /** The editor's snapping with it on; the overlay has none. */
  snap?: DragSnap | null;
  /** Whether a resize step keeps the start's shape: Shift or the editor's ratio lock. */
  keepsRatio?: (moveEvent: MouseEvent) => boolean;
}

const storedBoxOf = (widget: GestureWidget | undefined): WidgetBox => ({
  x: widget?.userSettings.x ?? 0,
  y: widget?.userSettings.y ?? 0,
  width: widget?.userSettings.currentWidth ?? FALLBACK_SIZE_PX,
  height: widget?.userSettings.currentHeight ?? FALLBACK_SIZE_PX,
});

/**
 * The box the widget drew at the press, in layout px (`offsetWidth` ignores
 * the canvas zoom). For a content-sized widget the stored width is only its
 * scale, not its size; zero when the box is not in the document.
 */
const drawnSizeAt = (
  event: React.MouseEvent
): Pick<WidgetBox, 'width' | 'height'> => {
  const drawnBox = (event.currentTarget as HTMLElement).closest<HTMLElement>(
    '[data-widget-id]'
  );

  return {
    width: drawnBox?.offsetWidth ?? 0,
    height: drawnBox?.offsetHeight ?? 0,
  };
};

/**
 * Drag and resize of a widget box, the same in the overlay's drag mode and on
 * the layout editor's canvas: pointer travel is divided by `viewScale` into
 * layout px, `resize-geometry` makes the box, the writer takes it. The writer
 * and the options are read at the press and hold for the whole gesture.
 */
export const useWidgetGestures = (
  widgetId: string,
  writer: GeometryWriter,
  options: WidgetGestureOptions
) => {
  const latestRef = useRef({ writer, options });

  useLayoutEffect(() => {
    latestRef.current = { writer, options };
  });

  // Ends whichever gesture is running, so an unmount mid-gesture does not
  // leave its document listeners behind.
  const endGestureRef = useRef<(() => void) | null>(null);

  useEffect(() => () => endGestureRef.current?.(), []);

  /** Takes the press, runs the host's start, and follows the pointer until release. */
  const beginGesture = useCallback(
    (
      event: React.MouseEvent,
      gesture: WidgetGestureOptions,
      gestureWriter: GeometryWriter,
      followPointer: (
        start: GestureWidget | undefined
      ) => (moveEvent: MouseEvent) => void
    ) => {
      event.preventDefault();
      event.stopPropagation();
      gesture.onGestureStart?.();

      const onMove = followPointer(gesture.widgets.getWidget(widgetId));

      const onRelease = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onRelease);
        endGestureRef.current = null;
        gestureWriter.end(widgetId);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onRelease);
      endGestureRef.current = onRelease;
    },
    [widgetId]
  );

  const onDragMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const { writer: gestureWriter, options: gesture } = latestRef.current;

      if (!gesture.enabled || event.button !== 0) {
        return;
      }

      const pressX = event.clientX;
      const pressY = event.clientY;
      const drawn = drawnSizeAt(event);

      beginGesture(event, gesture, gestureWriter, (widget) => {
        const stored = storedBoxOf(widget);
        // Centred by what is on screen; the stored size stands in only when
        // nothing was drawn.
        const size = drawn.width > 0 && drawn.height > 0 ? drawn : stored;

        return (moveEvent) => {
          const position = dragPosition({
            dx: (moveEvent.clientX - pressX) / gesture.viewScale,
            dy: (moveEvent.clientY - pressY) / gesture.viewScale,
            start: stored,
            size,
            snap: gesture.snap,
          });

          gestureWriter.move(widgetId, position.x, position.y);
        };
      });
    },
    [beginGesture, widgetId]
  );

  const onResizeMouseDown = useCallback(
    (event: React.MouseEvent, direction: ResizeDirection) => {
      const { writer: gestureWriter, options: gesture } = latestRef.current;

      if (!gesture.enabled || event.button !== 0) {
        return;
      }

      const pressX = event.clientX;
      const pressY = event.clientY;
      const drawn = drawnSizeAt(event);

      beginGesture(event, gesture, gestureWriter, (widget) => {
        const start = storedBoxOf(widget);
        const design = {
          width: widget?.designWidth ?? start.width,
          height: widget?.designHeight ?? start.height,
        };

        return (moveEvent) => {
          const box = resizeBox({
            direction,
            dx: (moveEvent.clientX - pressX) / gesture.viewScale,
            dy: (moveEvent.clientY - pressY) / gesture.viewScale,
            start,
            drawn,
            design,
            widget: {
              contentSized: widget?.contentSized,
              scaleFromHeight: widget?.scaleFromHeight,
              lockAspectRatio: widget?.lockAspectRatio,
            },
            snapGrid: gesture.snap?.gridSize ?? null,
            keepRatio: gesture.keepsRatio?.(moveEvent) ?? false,
          });

          gestureWriter.resize(widgetId, box, start);
        };
      });
    },
    [beginGesture, widgetId]
  );

  return { onDragMouseDown, onResizeMouseDown };
};
