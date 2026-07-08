import { useEffect, useLayoutEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { RootStore } from '@store/root-store';
import { RootStoreContext } from '@store/root-store-context';
import { useWidgetEditor } from '../WidgetSettings/WidgetEditorContext';
import { WIDGET_BY_ID } from '@store/widget-defaults';
import { WidgetIdContext } from '@app/overlay/components/WidgetContainer/WidgetIdContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import {
  seedScenario,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { seedInputHistory } from '@store/preview/preview-animator';
import styles from './WidgetPreview.module.scss';

interface WidgetPreviewProps {
  widgetId: string;
  scenarioId?: string;
}

// Renders a single widget the way the overlay would, but inside the main window
// against a seeded sample scenario. Settings are mirrored live from the main
// store so editing a panel updates the preview without touching real data.
export const WidgetPreview = observer(
  ({
    widgetId,
    scenarioId = DEFAULT_PREVIEW_SCENARIO_ID,
  }: WidgetPreviewProps) => {
    const editor = useWidgetEditor();

    const previewStore = useMemo(() => new RootStore({ skipInit: true }), []);

    useLayoutEffect(() => {
      seedScenario(previewStore, scenarioId);
    }, [previewStore, scenarioId]);

    useEffect(() => {
      seedInputHistory(previewStore);
    }, [previewStore, scenarioId]);

    const widget = editor.getWidget(widgetId);

    // Read the change token so the effect re-mirrors on any settings change.
    const mutationToken = editor.getChangeToken();

    useLayoutEffect(() => {
      if (!widget) return;

      previewStore.widgetSettings.applySettingsSync([
        {
          id: widget.id,
          label: widget.label,
          description: widget.description,
          designWidth: widget.designWidth,
          designHeight: widget.designHeight,
          autoHeight: widget.autoHeight,
          overflowVisible: widget.overflowVisible,
          transparentContainer: widget.transparentContainer,
          requiredCapabilities: widget.requiredCapabilities,
          userSettings: { ...widget.userSettings },
        },
      ]);
    }, [previewStore, widget, mutationToken]);

    const config = WIDGET_BY_ID.get(widgetId);
    const Widget = config?.component;

    if (!widget || !Widget) {
      return <div className={styles.empty}>No preview available</div>;
    }

    const { userSettings, designWidth, autoHeight, overflowVisible } = widget;
    const widgetScale = userSettings.currentWidth / designWidth;
    const backgroundColor =
      userSettings.backgroundColor ?? 'rgba(21, 22, 26, 0.8)';
    const borderColor = userSettings.borderColor ?? 'rgba(255, 255, 255, 0.1)';
    const background = widget.transparentContainer
      ? 'transparent'
      : backgroundColor;

    const showSteering =
      widgetId === 'input-trace' &&
      (userSettings as unknown as Record<string, unknown>).showSteering ===
        true;
    const steeringRadius = showSteering
      ? `calc(12px * var(--wfs, 1)) 9999px 9999px calc(12px * var(--wfs, 1))`
      : widgetId === 'race-dash'
        ? `calc(52px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(14px * var(--wfs, 1)) calc(52px * var(--wfs, 1))`
        : undefined;

    return (
      <RootStoreContext.Provider value={previewStore}>
        <div className={styles.stage}>
          <div
            className={`${styles.widgetInner} ${
              overflowVisible ? styles.overflowVisible : ''
            }`}
            style={
              {
                width: userSettings.currentWidth,
                height: autoHeight ? 'auto' : userSettings.currentHeight,
                background,
                borderColor: widget.transparentContainer
                  ? 'transparent'
                  : borderColor,
                borderWidth: widget.transparentContainer ? 0 : undefined,
                borderRadius: steeringRadius,
                ['--wfs']: widgetScale,
                ['--widget-bg']: backgroundColor,
                ['--widget-border']: borderColor,
              } as React.CSSProperties
            }
          >
            <ErrorBoundary>
              <WidgetIdContext.Provider value={widgetId}>
                <Widget />
              </WidgetIdContext.Provider>
            </ErrorBoundary>
          </div>
        </div>
      </RootStoreContext.Provider>
    );
  }
);
