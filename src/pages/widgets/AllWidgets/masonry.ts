import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { widgetScaleOf } from '@entities/widget/widget-frame';

/** The narrowest a column of miniatures gets before one fewer fits. */
export const MIN_COLUMN_WIDTH = 220;

/** How tall a miniature may get, in column widths, before it is fitted by height. */
const MAX_HEIGHT_IN_COLUMNS = 1.5;

/** The space between columns, and between miniatures in a column. */
export const COLUMN_GAP = 14;

/**
 * The All widgets grid's columns for a box this wide: as many equal columns as
 * fit, the items dealt across them in turn so each row reads in the given
 * order while the columns run to their own heights.
 */
export const masonryColumns = <Item>(
  boxWidth: number,
  items: readonly Item[]
): { columns: Item[][]; width: number } => {
  const count = Math.max(
    1,
    Math.floor((boxWidth + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP))
  );
  const width = (boxWidth - COLUMN_GAP * (count - 1)) / count;
  const columns: Item[][] = Array.from({ length: count }, () => []);

  items.forEach((item, index) => {
    columns[index % count].push(item);
  });

  return { columns, width };
};

export interface MiniatureGeometry {
  width: number | 'auto';
  height: number | 'auto';
  /** The widget's `--wfs` at this size. */
  scale: number;
}

/**
 * A widget drawn as a miniature in a column this wide: its stored size shrunk
 * to the column, proportions kept, and its content scaled with it. A widget
 * taller than it is wide is fitted by height, so it never runs down the whole
 * column; an axis the widget sizes itself stays `auto`.
 */
export const miniatureGeometry = (
  widget: WidgetDefaultConfig,
  columnWidth: number
): MiniatureGeometry => {
  const { currentWidth, currentHeight } = widget.userSettings;
  const ownsHeight = widget.autoHeight || widget.contentSized;
  const widthFit = columnWidth / currentWidth;
  const heightFit = (columnWidth * MAX_HEIGHT_IN_COLUMNS) / currentHeight;
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
