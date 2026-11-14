import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { componentForWidget } from '@widgets/registry';
import { WidgetInstanceScope } from '@widgets/instance-scope/WidgetInstanceScope';
import { WidgetIdContext } from '@entities/widget/WidgetIdContext';
import { widgetFrameStyle } from '@entities/widget/widget-frame';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import {
  catalogColumns,
  COLUMN_GAP,
  MAX_HEIGHT_IN_COLUMNS,
  miniatureGeometry,
  ROW_UNIT,
  rowSpan,
  tileSpan,
} from './masonry';
import { useCatalogPreviewWorld } from './use-catalog-preview-world';
import styles from './AllWidgets.module.scss';

/** The card's room around its miniature; its border is drawn inside it. */
const CARD_PADDING = 10;

interface AllWidgetsProps {
  /** In the widget menu's order. */
  widgets: readonly WidgetDefaultConfig[];
  isAvailable: (widgetId: string) => boolean;
  labelOf: (widget: WidgetDefaultConfig) => string;
  onOpen: (widgetId: string) => void;
}

const Miniature = observer(
  ({
    widget,
    width: tileWidth,
    maxHeight,
  }: {
    widget: WidgetDefaultConfig;
    width: number;
    maxHeight: number;
  }) => {
    const Widget = componentForWidget(widget.type);

    if (!Widget) {
      return null;
    }

    const { width, height, scale } = miniatureGeometry(
      widget,
      tileWidth,
      maxHeight
    );
    const { userSettings, autoHeight, contentSized } = widget;

    return (
      <div
        className={styles.frame}
        style={{
          ...widgetFrameStyle({
            widgetType: widget.type,
            userSettings,
            widgetScale: scale,
            transparentContainer: widget.transparentContainer,
            autoHeight,
            contentSized,
          }),
          width,
          height,
        }}
      >
        <ErrorBoundary>
          <WidgetIdContext.Provider value={widget.id}>
            <WidgetInstanceScope type={widget.type} instanceId={widget.id}>
              <Widget />
            </WidgetInstanceScope>
          </WidgetIdContext.Provider>
        </ErrorBoundary>
      </div>
    );
  }
);

/**
 * One card of the grid: as many columns as its widget is wide, as many rows
 * as its miniature turns out tall — measured, since a widget that sizes
 * itself has no height until it is drawn.
 */
const CatalogTile = observer(
  ({
    widget,
    span,
    width,
    maxHeight,
    label,
    isAvailable,
    onOpen,
  }: {
    widget: WidgetDefaultConfig;
    span: number;
    width: number;
    maxHeight: number;
    label: string;
    isAvailable: boolean;
    onOpen: () => void;
  }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rows, setRows] = useState(1);

    useLayoutEffect(() => {
      const card = cardRef.current;

      if (!card) {
        return;
      }

      const resizeObserver = new ResizeObserver(() =>
        setRows(rowSpan(card.offsetHeight))
      );

      resizeObserver.observe(card);

      return () => resizeObserver.disconnect();
    }, []);

    return (
      <div style={{ gridColumn: `span ${span}`, gridRowEnd: `span ${rows}` }}>
        <div
          ref={cardRef}
          className={styles.card}
          style={{ padding: CARD_PADDING }}
        >
          <Miniature
            widget={widget}
            width={width - 2 * CARD_PADDING}
            maxHeight={maxHeight}
          />
          {/* Over the miniature, not around it: a widget may hold controls of
              its own, and a button cannot. */}
          <button
            type="button"
            className={styles.open}
            title={label}
            aria-label={label}
            disabled={!isAvailable}
            onClick={onOpen}
          />
        </div>
      </div>
    );
  }
);

/**
 * All widgets: live miniatures on the preview's sample data, unlabelled (the
 * name is the tooltip), packed in a grid that fills the width. A wider widget
 * spans more columns; cards pack under one another whatever their height. A
 * card opens its widget.
 */
export const AllWidgets = observer(
  ({ widgets, isAvailable, labelOf, onOpen }: AllWidgetsProps) => {
    const { Provide } = useCatalogPreviewWorld();
    const boxRef = useRef<HTMLDivElement>(null);
    const [boxWidth, setBoxWidth] = useState(0);

    useLayoutEffect(() => {
      const box = boxRef.current;

      if (!box) {
        return;
      }

      const resizeObserver = new ResizeObserver(([entry]) =>
        setBoxWidth(entry.contentRect.width)
      );

      resizeObserver.observe(box);

      return () => resizeObserver.disconnect();
    }, []);

    const columns = catalogColumns(boxWidth);
    const maxHeight = columns.width * MAX_HEIGHT_IN_COLUMNS - 2 * CARD_PADDING;

    return (
      <Provide>
        <div
          ref={boxRef}
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(${columns.count}, minmax(0, 1fr))`,
            gridAutoRows: ROW_UNIT,
            columnGap: COLUMN_GAP,
          }}
        >
          {boxWidth > 0 &&
            widgets.map((widget) => {
              const span = tileSpan(widget, columns.count, {
                columnWidth: columns.width,
                maxHeight,
              });

              return (
                <CatalogTile
                  key={widget.id}
                  widget={widget}
                  span={span}
                  width={span * columns.width + (span - 1) * COLUMN_GAP}
                  maxHeight={maxHeight}
                  label={labelOf(widget)}
                  isAvailable={isAvailable(widget.id)}
                  onOpen={() => onOpen(widget.id)}
                />
              );
            })}
        </div>
      </Provide>
    );
  }
);
