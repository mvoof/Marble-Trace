import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useSeededPreviewWorld } from '@features/preview/use-seeded-preview-world';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { componentForWidget } from '@widgets/registry';
import { WidgetInstanceScope } from '@widgets/instance-scope/WidgetInstanceScope';
import { WidgetIdContext } from '@entities/widget/WidgetIdContext';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import {
  widgetBoxSize,
  widgetFrameStyle,
  widgetScaleOf,
} from '@entities/widget/widget-frame';
import { DEFAULT_PREVIEW_SCENARIO_ID } from '@features/preview/scenarios';
import { useDragToPan } from './use-drag-to-pan';
import styles from './WidgetPreview.module.scss';

export interface PreviewRoom {
  width: number;
  height: number;
}

interface WidgetPreviewProps {
  widgetId: string;
  scenarioId?: string;
  /** The most the widget may take, the stage's padding left out. */
  room?: PreviewRoom | null;
  /** Shrinks a widget bigger than the room to fit it; off, it scrolls at 1:1. */
  fit?: boolean;
  /** The stage takes the whole room rather than the widget's height. */
  fillRoom?: boolean;
}

/** How far a widget this big shrinks to fit the room; never enlarged. */
const fitScaleOf = (
  room: PreviewRoom | null | undefined,
  naturalSize: PreviewRoom | null
): number => {
  if (!room || !naturalSize || naturalSize.width === 0) {
    return 1;
  }

  return Math.min(
    1,
    room.width / naturalSize.width,
    naturalSize.height === 0 ? 1 : room.height / naturalSize.height
  );
};

// Renders a single widget the way the overlay would, but inside the main window
// against a seeded sample scenario. Settings are mirrored live from the main
// store so editing a panel updates the preview without touching real data.
export const WidgetPreview = observer(
  ({
    widgetId,
    scenarioId = DEFAULT_PREVIEW_SCENARIO_ID,
    room = null,
    fit = false,
    fillRoom = false,
  }: WidgetPreviewProps) => {
    const editor = useWidgetEditor();
    // A state, not a ref: the box mounts only once the widget is found.
    const [widgetBox, setWidgetBox] = useState<HTMLDivElement | null>(null);
    // The widget's own size, unscaled: a transform does not touch the layout
    // box this reads, so fitting never feeds back into what is fitted.
    const [naturalSize, setNaturalSize] = useState<PreviewRoom | null>(null);
    const { isPanning, panHandlers } = useDragToPan();

    useLayoutEffect(() => {
      if (!widgetBox) {
        return;
      }

      const measure = () =>
        setNaturalSize({
          width: widgetBox.offsetWidth,
          height: widgetBox.offsetHeight,
        });

      measure();

      const resizeObserver = new ResizeObserver(measure);

      resizeObserver.observe(widgetBox);

      return () => resizeObserver.disconnect();
    }, [widgetBox]);
    const { t } = useTranslation('main-app');

    const previewWorld = useSeededPreviewWorld(scenarioId);
    const previewStore = previewWorld.core;
    const PreviewProvide = previewWorld.Provide;

    const widget = editor.getWidget(widgetId);

    // The preview world holds one record per widget, seeded from the catalog,
    // so a copy is mirrored onto its type's record there rather than added
    // beside it: the preview shows what this copy looks like, and only ever one
    // widget at a time.
    const previewId = widget ? widget.type : widgetId;

    // Read the change token so the effect re-mirrors on any settings change.
    const mutationToken = editor.getChangeToken();

    useLayoutEffect(() => {
      if (!widget) return;

      previewStore.liveWidgets.applySettingsSync([
        {
          id: previewId,
          type: widget.type,
          label: widget.label,
          description: widget.description,
          designWidth: widget.designWidth,
          designHeight: widget.designHeight,
          autoHeight: widget.autoHeight,
          contentSized: widget.contentSized,
          overflowVisible: widget.overflowVisible,
          transparentContainer: widget.transparentContainer,
          requiredCapabilities: widget.requiredCapabilities,
          userSettings: { ...widget.userSettings },
        },
      ]);
    }, [previewStore, widget, previewId, mutationToken]);

    const Widget = componentForWidget(previewId);

    if (!widget || !Widget) {
      return <div className={styles.empty}>{t('widgetPreview.noPreview')}</div>;
    }

    const {
      userSettings,
      designWidth,
      autoHeight,
      contentSized,
      overflowVisible,
    } = widget;
    const widgetScale = widgetScaleOf({
      scaleFromHeight: widget.scaleFromHeight,
      width: userSettings.currentWidth,
      height: userSettings.currentHeight,
      designWidth,
      designHeight: widget.designHeight,
    });
    const frameStyle = widgetFrameStyle({
      widgetType: widget ? widget.type : widgetId,
      userSettings,
      widgetScale,
      transparentContainer: widget.transparentContainer,
      autoHeight,
      contentSized,
    });

    const boxSize = widgetBoxSize({
      width: userSettings.currentWidth,
      height: userSettings.currentHeight,
      autoHeight,
      contentSized,
    });
    const fitScale = fitScaleOf(fit ? room : null, naturalSize);
    const fittedSize = naturalSize && {
      width: naturalSize.width * fitScale,
      height: naturalSize.height * fitScale,
    };
    // At 1:1 a widget bigger than the room scrolls, and the hand drags it.
    const overflowsRoom = Boolean(
      room &&
      fittedSize &&
      (fittedSize.width > room.width + 1 || fittedSize.height > room.height + 1)
    );

    return (
      <PreviewProvide>
        <div
          className={[
            fillRoom ? styles.stageFill : styles.stage,
            overflowsRoom ? styles.pannable : '',
            isPanning ? styles.panning : '',
          ].join(' ')}
          {...panHandlers}
          style={
            fittedSize
              ? ({
                  '--fitted-height': `${fittedSize.height}px`,
                } as CSSProperties)
              : undefined
          }
        >
          <div className={styles.fitBox} style={fittedSize ?? undefined}>
            <div
              ref={setWidgetBox}
              className={`${styles.widgetInner} ${
                overflowVisible ? styles.overflowVisible : ''
              }`}
              style={{
                ...boxSize,
                // Absolute in a box of the fitted size, a widget that sizes
                // itself would take that box's width and shrink to fit it.
                width: boxSize.width === 'auto' ? 'max-content' : boxSize.width,
                transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
                ...frameStyle,
              }}
            >
              <ErrorBoundary>
                <WidgetIdContext.Provider value={previewId}>
                  <WidgetInstanceScope
                    type={widget.type}
                    instanceId={previewId}
                  >
                    <Widget />
                  </WidgetInstanceScope>
                </WidgetIdContext.Provider>
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </PreviewProvide>
    );
  }
);
