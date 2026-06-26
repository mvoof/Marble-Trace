import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { RootStore } from '@store/root-store';
import {
  RootStoreContext,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { WIDGET_BY_ID } from '@store/widget-defaults';
import { WidgetIdContext } from '@app/overlay/components/WidgetContainer/WidgetIdContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import {
  seedScenario,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import { LayoutCanvasWidget } from './LayoutCanvasWidget';
import styles from './LayoutCanvas.module.scss';

interface LayoutCanvasProps {
  scenarioId?: string;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
}

// Mirror the full widget set from the main store into the isolated preview store
// so every widget on the canvas renders against sample telemetry while reflecting
// live edits. Positions/sizes are read from the main store directly by the
// canvas; only content-affecting settings need mirroring here.
const mirrorAllWidgets = (
  source: WidgetDefaultConfig[],
  previewStore: RootStore
) => {
  previewStore.widgetSettings.applySettingsSync(
    source.map((widget) => ({
      ...widget,
      userSettings: toJS(widget.userSettings),
    }))
  );
};

// Letterboxed editor canvas: a fixed target-resolution world scaled to fit the
// available pane (WYSIWYG with the overlay). Each enabled widget is a draggable,
// resizable box writing back into the main store — the single source of truth.
export const LayoutCanvas = observer(
  ({
    scenarioId = DEFAULT_PREVIEW_SCENARIO_ID,
    selectedWidgetId,
    onSelectWidget,
  }: LayoutCanvasProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const previewStore = useMemo(() => new RootStore({ skipInit: true }), []);

    const paneRef = useRef<HTMLDivElement | null>(null);
    const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
      seedScenario(previewStore, scenarioId);
    }, [previewStore, scenarioId]);

    useLayoutEffect(() => {
      mirrorAllWidgets(widgetSettings.allWidgets, previewStore);

      return reaction(
        () => widgetSettings.changeToken,
        () => mirrorAllWidgets(widgetSettings.allWidgets, previewStore)
      );
    }, [previewStore, widgetSettings]);

    useLayoutEffect(() => {
      const pane = paneRef.current;

      if (!pane) {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];

        setPaneSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });

      observer.observe(pane);

      return () => observer.disconnect();
    }, []);

    const targetResolution = widgetSettings.overlayResolution;

    const fit =
      paneSize.width > 0 && paneSize.height > 0
        ? Math.min(
            paneSize.width / targetResolution.width,
            paneSize.height / targetResolution.height
          )
        : 0;

    const scaledWidth = targetResolution.width * fit;
    const scaledHeight = targetResolution.height * fit;

    return (
      <RootStoreContext.Provider value={previewStore}>
        <div className={styles.pane} ref={paneRef}>
          {fit > 0 && (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              className={styles.stage}
              style={{ width: scaledWidth, height: scaledHeight }}
              onMouseDown={() => onSelectWidget('')}
            >
              <div
                className={styles.world}
                style={{
                  width: targetResolution.width,
                  height: targetResolution.height,
                  transform: `scale(${fit})`,
                }}
              >
                {widgetSettings.enabledWidgetIds.map((id) => {
                  const config = WIDGET_BY_ID.get(id);

                  if (!config) {
                    return null;
                  }

                  const Widget = config.component;

                  return (
                    <LayoutCanvasWidget
                      key={id}
                      widgetId={id}
                      fit={fit}
                      mainSettings={widgetSettings}
                      isSelected={selectedWidgetId === id}
                      onSelect={onSelectWidget}
                    >
                      <ErrorBoundary>
                        <WidgetIdContext.Provider value={id}>
                          <Widget />
                        </WidgetIdContext.Provider>
                      </ErrorBoundary>
                    </LayoutCanvasWidget>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </RootStoreContext.Provider>
    );
  }
);
