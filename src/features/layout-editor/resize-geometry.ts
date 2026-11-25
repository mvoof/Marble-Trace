import {
  scaleFromCorner,
  type ResizeDirection,
} from '@entities/widget/widget-frame';

/** No widget is dragged smaller than this, whatever its design size. */
const MIN_SIZE_PX = 20;

/** …nor below this share of its design size. */
const MIN_DESIGN_SHARE = 0.2;

export interface WidgetBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeInput {
  direction: ResizeDirection;
  /** Pointer travel since the press, in layout pixels. */
  dx: number;
  dy: number;
  /** The stored geometry at the press. */
  start: WidgetBox;
  /** The box it drew at the press — only a content-sized widget reads it. */
  drawn: { width: number; height: number };
  design: { width: number; height: number };
  widget: {
    contentSized?: boolean;
    scaleFromHeight?: boolean;
    lockAspectRatio?: boolean;
  };
  /** The grid pitch for resize snapping. */
  snapGrid?: number | null;
  /** Shift held, or the ratio pinned in the editor: keep the start's shape. */
  keepRatio?: boolean;
}

export const snapToGrid = (value: number, gridSize: number): number =>
  Math.round(value / gridSize) * gridSize;

/** Snap distance (layout px) for centring a dragged widget on its screen. */
const SNAP_CENTER_THRESHOLD = 24;

/** The grid pitch, and optionally the screen to centre on. */
export interface DragSnap {
  gridSize: number;
  area?: WidgetBox;
}

export interface DragInput {
  /** Pointer travel since the press, in layout pixels. */
  dx: number;
  dy: number;
  /** The stored position at the press. */
  start: { x: number; y: number };
  /** The stored size, which the centring measures. */
  size: { width: number; height: number };
  /** The active placement grid. */
  snap?: DragSnap | null;
}

/**
 * The position a drag gives a widget: the start moved with the pointer, then,
 * with snapping on, put on the grid — and onto the screen's centre lines when
 * it comes close to them.
 */
export const dragPosition = ({
  dx,
  dy,
  start,
  size,
  snap = null,
}: DragInput): { x: number; y: number } => {
  let x = Math.round(start.x + dx);
  let y = Math.round(start.y + dy);

  if (snap === null) {
    return { x, y };
  }

  x = snapToGrid(x, snap.gridSize);
  y = snapToGrid(y, snap.gridSize);

  if (!snap.area) {
    return { x, y };
  }

  const centreX = snap.area.x + snap.area.width / 2;
  const centreY = snap.area.y + snap.area.height / 2;

  if (Math.abs(x + size.width / 2 - centreX) < SNAP_CENTER_THRESHOLD) {
    x = Math.round(centreX - size.width / 2);
  }

  if (Math.abs(y + size.height / 2 - centreY) < SNAP_CENTER_THRESHOLD) {
    y = Math.round(centreY - size.height / 2);
  }

  return { x, y };
};

const resizedSpan = (
  anchor: number,
  span: number,
  minimum: number,
  fromStart: boolean,
  gridSize: number | null
): number => {
  if (gridSize === null) {
    return Math.max(minimum, Math.round(span));
  }

  const sign = fromStart ? -1 : 1;
  const nearestEdge = snapToGrid(anchor + sign * span, gridSize);
  const limit = anchor + sign * minimum;
  const firstLegalEdge = fromStart
    ? Math.floor(limit / gridSize) * gridSize
    : Math.ceil(limit / gridSize) * gridSize;

  return Math.max(
    sign * (nearestEdge - anchor),
    sign * (firstLegalEdge - anchor)
  );
};

/**
 * The box a resize drag gives a widget — the one rule the overlay's drag mode
 * and the layout editor both follow, so a widget resizes the same in both.
 *
 * A content-sized widget only scales from its corner. Otherwise the dragged
 * edges move with the pointer (and the grid), then the widget's own
 * constraint shapes the height: scaled from height, a corner keeps the
 * current shape; aspect-locked, the height follows the design ratio; and a
 * free widget keeps its shape only when asked to.
 */
export const resizeBox = ({
  direction,
  dx,
  dy,
  start,
  drawn,
  design,
  widget,
  snapGrid = null,
  keepRatio = false,
}: ResizeInput): WidgetBox => {
  const minWidth = Math.max(
    MIN_SIZE_PX,
    Math.round(design.width * MIN_DESIGN_SHARE)
  );
  const minHeight = Math.max(
    MIN_SIZE_PX,
    Math.round(design.height * MIN_DESIGN_SHARE)
  );

  const fromWest = direction.includes('w');
  const fromNorth = direction.includes('n');

  if (widget.contentSized) {
    let cornerTravel = dx;

    if (snapGrid !== null && start.width > 0 && drawn.width > 0) {
      const sign = fromWest ? -1 : 1;
      const anchor = fromWest ? start.x + drawn.width : start.x;
      const span = resizedSpan(
        anchor,
        drawn.width + sign * dx,
        (minWidth * drawn.width) / start.width,
        fromWest,
        snapGrid
      );
      cornerTravel = sign * (span - drawn.width);
    }

    return scaleFromCorner({
      direction,
      dx: cornerTravel,
      start,
      drawn,
      minWidth,
    });
  }

  let width = start.width;
  let height = start.height;

  if (direction.includes('e')) {
    width = resizedSpan(start.x, start.width + dx, minWidth, false, snapGrid);
  }

  if (fromWest) {
    width = resizedSpan(
      start.x + start.width,
      start.width - dx,
      minWidth,
      true,
      snapGrid
    );
  }

  if (direction.includes('s')) {
    height = resizedSpan(
      start.y,
      start.height + dy,
      minHeight,
      false,
      snapGrid
    );
  }

  if (fromNorth) {
    height = resizedSpan(
      start.y + start.height,
      start.height - dy,
      minHeight,
      true,
      snapGrid
    );
  }

  const isCorner = direction.length === 2;

  if (widget.scaleFromHeight) {
    // e/w only stretches the widget (its scale comes from the unchanged
    // height); a corner rescales it keeping the current shape.
    height =
      isCorner && start.width > 0 && start.height > 0
        ? Math.max(minHeight, Math.round(width * (start.height / start.width)))
        : start.height;
  } else if (widget.lockAspectRatio) {
    // Only e/w and corner handles are offered: the height always tracks the
    // design ratio, so a badge sized off the height never distorts.
    height = Math.max(
      minHeight,
      Math.round(width * (design.height / design.width))
    );
  } else if (keepRatio && start.width > 0 && start.height > 0) {
    const aspect = start.width / start.height;

    if (direction === 'n' || direction === 's') {
      width = Math.max(minWidth, Math.round(height * aspect));
    } else {
      height = Math.max(minHeight, Math.round(width / aspect));
    }
  }

  return {
    x: fromWest ? Math.round(start.x + start.width - width) : start.x,
    y: fromNorth ? Math.round(start.y + start.height - height) : start.y,
    width,
    height,
  };
};
