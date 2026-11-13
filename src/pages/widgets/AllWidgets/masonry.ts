import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { widgetScaleOf } from '@entities/widget/widget-frame';

/** The narrowest a column of the All widgets grid gets before one fewer fits. */
const MIN_COLUMN_WIDTH = 200;

/** The space between columns, and below every card. */
export const COLUMN_GAP = 14;

/**
 * How many widget pixels one column stands for: a widget's stored width over
 * this is how many columns its card spans, so a bigger widget gets a bigger
 * card (Standings spans three, a delta bar one).
 */
const WIDGET_PIXELS_PER_COLUMN = 300;

/**
 * The rows the grid is cut into; a card spans as many as its height takes, so
 * cards of any height pack under one another.
 */
export const ROW_UNIT = 2;

/** How tall a miniature may get, in column widths, before it is fitted by height. */
export const MAX_HEIGHT_IN_COLUMNS = 1.5;

/**
 * The All widgets grid's columns for a box this wide: as many as fit, each
 * stretched to fill the box, so the cards grow and shrink with the window.
 */
export const catalogColumns = (
  boxWidth: number
): { count: number; width: number } => {
  const count = Math.max(
    1,
    Math.floor((boxWidth + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP))
  );

  return { count, width: (boxWidth - COLUMN_GAP * (count - 1)) / count };
};

/** What a card's height is held to, to give back the columns it leaves empty. */
interface TileFit {
  columnWidth: number;
  maxHeight: number;
}

const spanWidth = (span: number, columnWidth: number): number =>
  span * columnWidth + (span - 1) * COLUMN_GAP;

/**
 * How many of the grid's columns a widget's card spans: more for a wider
 * widget. Given the fit, a widget held to the height limit gives back the
 * columns its narrower miniature would leave empty.
 */
export const tileSpan = (
  widget: WidgetDefaultConfig,
  columnCount: number,
  fit?: TileFit
): number => {
  const span = Math.min(
    columnCount,
    Math.max(
      1,
      Math.round(widget.userSettings.currentWidth / WIDGET_PIXELS_PER_COLUMN)
    )
  );

  if (!fit) {
    return span;
  }

  const { width } = miniatureGeometry(
    widget,
    spanWidth(span, fit.columnWidth),
    fit.maxHeight
  );

  if (width === 'auto') {
    return span;
  }

  const needed = Math.ceil(
    (width + COLUMN_GAP) / (fit.columnWidth + COLUMN_GAP)
  );

  return Math.min(span, Math.max(1, needed));
};

/** The grid rows a card this tall spans, the gap below it included. */
export const rowSpan = (cardHeight: number): number =>
  Math.ceil((cardHeight + COLUMN_GAP) / ROW_UNIT);

export interface MiniatureGeometry {
  width: number | 'auto';
  height: number | 'auto';
  /** The widget's `--wfs` at this size. */
  scale: number;
}

/**
 * A widget drawn as a miniature this wide: its stored size shrunk to the
 * width, proportions kept, and its content scaled with it. One that would come
 * out taller than `maxHeight` is fitted by height instead, so a wide card is
 * never taller than a tall narrow one; an axis the widget sizes itself stays
 * `auto`.
 */
export const miniatureGeometry = (
  widget: WidgetDefaultConfig,
  width: number,
  maxHeight: number
): MiniatureGeometry => {
  const { currentWidth, currentHeight } = widget.userSettings;
  const ownsHeight = widget.autoHeight || widget.contentSized;
  const widthFit = width / currentWidth;
  const heightFit = maxHeight / currentHeight;
  const shrink = ownsHeight ? widthFit : Math.min(widthFit, heightFit);

  const storedScale = widgetScaleOf({
    scaleFromHeight: widget.scaleFromHeight,
    width: currentWidth,
    height: currentHeight,
    designWidth: widget.designWidth,
    designHeight: widget.designHeight,
  });

  return {
    width: widget.contentSized ? 'auto' : currentWidth * shrink,
    height: ownsHeight ? 'auto' : currentHeight * shrink,
    scale: storedScale * shrink,
  };
};
