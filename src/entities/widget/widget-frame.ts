import type { CSSProperties } from 'react';
import {
  PILL_CORNER,
  type WidgetFrameShape,
  type WidgetUserSettings,
} from '@shared/contracts/widget-settings';
import { getContrastTextColor } from '@shared/lib/colors';

import { WIDGET_BY_ID } from './widget-catalog';

/** A pill end: far past any widget's half-height, and never scaled. */
const PILL_RADIUS = '9999px';

/** The CSS radius of a frame shape, at the widget's scale. */
export const frameShapeRadius = (
  shape: WidgetFrameShape,
  userSettings: Record<string, unknown>
): string | undefined => {
  if (shape.kind === 'circle') {
    return '50%';
  }

  if (
    shape.whenSetting !== undefined &&
    userSettings[shape.whenSetting] !== true
  ) {
    return undefined;
  }

  return shape.radiiPx
    .map((radius) =>
      radius === PILL_CORNER ? PILL_RADIUS : `calc(${radius}px * var(--wfs, 1))`
    )
    .join(' ');
};

/**
 * The radius every frame that hosts a widget clips with — overlay container,
 * widget preview, layout editor — from the shape its manifest declares.
 */
export const widgetFrameBorderRadius = (
  widgetType: string,
  userSettings: Record<string, unknown>
): string | undefined => {
  const shape = WIDGET_BY_ID.get(widgetType)?.frameShape;

  return shape ? frameShapeRadius(shape, userSettings) : undefined;
};

/**
 * The widget's scale, `--wfs`: its drawn size over its design size — by the
 * height for a widget that scales from it, by the width otherwise. The one
 * formula every host uses: overlay, editor, preview and remote screen.
 */
export const widgetScaleOf = ({
  scaleFromHeight = false,
  width,
  height,
  designWidth,
  designHeight,
}: {
  scaleFromHeight?: boolean;
  width: number;
  height: number;
  designWidth: number;
  designHeight: number;
}): number => (scaleFromHeight ? height / designHeight : width / designWidth);

export const DEFAULT_WIDGET_BACKGROUND = 'rgba(21, 22, 26, 0.8)';
export const DEFAULT_WIDGET_BORDER = 'rgba(255, 255, 255, 0.1)';

interface WidgetFrameStyleInput {
  widgetType: string;
  userSettings: Partial<WidgetUserSettings>;
  widgetScale: number;
  transparentContainer?: boolean;
  autoHeight?: boolean;
  /** The frame hugs a plate sized by its content, in both axes. */
  contentSized?: boolean;
  /** A hidden widget keeps its frame but drops its body, so drop the plate too. */
  hidden?: boolean;
}

/**
 * The CSS size of the box that hosts a widget, from its stored geometry: auto
 * in each axis the widget sizes itself in. Shared by every host, as the plate
 * style is.
 */
export const widgetBoxSize = ({
  width,
  height,
  autoHeight = false,
  contentSized = false,
}: {
  width: number;
  height: number;
  autoHeight?: boolean;
  contentSized?: boolean;
}): { width: number | 'auto'; height: number | 'auto' } => ({
  width: contentSized ? 'auto' : width,
  height: autoHeight || contentSized ? 'auto' : height,
});

/**
 * The plate every frame that hosts a widget paints — overlay container, layout
 * editor, settings preview and remote screen. One place decides how the user's
 * appearance settings become CSS, so a new one (the background opacity, say)
 * reaches all four at once.
 */
export const widgetFrameStyle = ({
  widgetType,
  userSettings,
  widgetScale,
  transparentContainer = false,
  autoHeight = false,
  contentSized = false,
  hidden = false,
}: WidgetFrameStyleInput): CSSProperties => {
  const backgroundColor =
    userSettings.backgroundColor ?? DEFAULT_WIDGET_BACKGROUND;

  const borderColor = userSettings.borderColor ?? DEFAULT_WIDGET_BORDER;
  const isPlateless = transparentContainer || hidden;
  const textColor = isPlateless
    ? '#ffffff'
    : getContrastTextColor(backgroundColor);

  return {
    ...(autoHeight || contentSized ? { height: 'auto' } : undefined),
    ...(contentSized ? { width: 'auto' } : undefined),
    background: isPlateless ? 'transparent' : backgroundColor,
    borderColor: isPlateless ? 'transparent' : borderColor,
    borderWidth: transparentContainer ? 0 : undefined,
    borderRadius: widgetFrameBorderRadius(
      widgetType,
      userSettings as unknown as Record<string, unknown>
    ),
    ['--wfs']: widgetScale,
    ['--font-scale']: userSettings.fontScale ?? 1,
    ['--widget-bg']: backgroundColor,
    ['--widget-border']: borderColor,
    ['--widget-text-color']: textColor,
  } as CSSProperties;
};

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

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

// Aspect-locked widgets keep the corners so they can be scaled up as a whole,
// but never the n/s edges — height is derived, not dragged.
const LOCKED_RATIO_DIRECTIONS: ResizeDirection[] = [
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];

// A content-sized widget stretches in neither axis; the only thing a drag can
// change is its scale, and only a corner reads as that.
const CORNER_DIRECTIONS: ResizeDirection[] = ['ne', 'nw', 'se', 'sw'];

interface ResizeConstraints {
  autoHeight?: boolean;
  contentSized?: boolean;
  lockAspectRatio?: boolean;
  scaleFromHeight?: boolean;
}

/**
 * Which handles a widget offers — only those that change something it draws.
 * Shared by the overlay's drag mode and the layout editor so both grow the
 * same affordances from the same rule.
 */
export const resizeDirectionsFor = ({
  autoHeight = false,
  contentSized = false,
  lockAspectRatio = false,
  scaleFromHeight = false,
}: ResizeConstraints): ResizeDirection[] => {
  if (contentSized) {
    return CORNER_DIRECTIONS;
  }

  if (autoHeight) {
    return HORIZONTAL_DIRECTIONS;
  }

  if (lockAspectRatio || scaleFromHeight) {
    return LOCKED_RATIO_DIRECTIONS;
  }

  return ALL_DIRECTIONS;
};

export interface CornerScaleInput {
  direction: ResizeDirection;
  /** Horizontal drag since the press, in layout pixels. */
  dx: number;
  /** The widget's stored geometry at the press. */
  start: { x: number; y: number; width: number; height: number };
  /** The box it drew at the press (`offsetWidth`/`offsetHeight`), in layout pixels. */
  drawn: { width: number; height: number };
  minWidth: number;
}

/**
 * A content-sized widget scaled from one of its corners. Its drawn box is
 * narrower than its stored width, but both scale together, so the drag is
 * turned into a scale factor on the drawn box: the dragged corner follows the
 * pointer and the opposite one stays where it was.
 */
export const scaleFromCorner = ({
  direction,
  dx,
  start,
  drawn,
  minWidth,
}: CornerScaleInput): {
  x: number;
  y: number;
  width: number;
  height: number;
} => {
  if (drawn.width <= 0 || start.width <= 0) {
    return start;
  }

  const towardsEast = direction.includes('e');
  const targetWidth = drawn.width + (towardsEast ? dx : -dx);
  const width = Math.max(
    minWidth,
    Math.round(start.width * (targetWidth / drawn.width))
  );
  const factor = width / start.width;
  const drawnWidth = drawn.width * factor;
  const drawnHeight = drawn.height * factor;

  return {
    x: towardsEast ? start.x : Math.round(start.x + drawn.width - drawnWidth),
    y: direction.includes('n')
      ? Math.round(start.y + drawn.height - drawnHeight)
      : start.y,
    width,
    height: Math.round(start.height * factor),
  };
};
