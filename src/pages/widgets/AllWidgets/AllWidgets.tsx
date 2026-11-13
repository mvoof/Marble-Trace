import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { componentForWidget } from '@widgets/registry';
import { WidgetInstanceScope } from '@widgets/instance-scope/WidgetInstanceScope';
import { WidgetIdContext } from '@entities/widget/WidgetIdContext';
import { widgetFrameStyle } from '@entities/widget/widget-frame';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { COLUMN_GAP, masonryColumns, miniatureGeometry } from './masonry';
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
    columnWidth,
  }: {
    widget: WidgetDefaultConfig;
    columnWidth: number;
  }) => {
    const Widget = componentForWidget(widget.type);

    if (!Widget) {
      return null;
    }

    const { width, height, scale } = miniatureGeometry(widget, columnWidth);
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
 * All widgets: masonry columns of live miniatures on the preview's sample
 * data, unlabelled (the name is the tooltip); a card opens its widget.
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

    const { columns, width } = masonryColumns(boxWidth, widgets);

    return (
      <Provide>
        <div ref={boxRef} className={styles.grid} style={{ gap: COLUMN_GAP }}>
          {boxWidth > 0 &&
            columns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className={styles.column}
                style={{ width, gap: COLUMN_GAP }}
              >
                {column.map((widget) => {
                  const label = labelOf(widget);

                  return (
                    <div
                      key={widget.id}
                      className={styles.card}
                      style={{ padding: CARD_PADDING }}
                    >
                      <Miniature
                        widget={widget}
                        columnWidth={width - 2 * CARD_PADDING}
                      />
                      {/* Over the miniature, not around it: a widget may
                          hold controls of its own, and a button cannot. */}
                      <button
                        type="button"
                        className={styles.open}
                        title={label}
                        aria-label={label}
                        disabled={!isAvailable(widget.id)}
                        onClick={() => onOpen(widget.id)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </Provide>
    );
  }
);
