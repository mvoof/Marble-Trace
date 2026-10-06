import { useEffect, useLayoutEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { PreviewCore } from '@store/roots/renderer-core';
import {
  RendererCoreContext,
  useUnitsStore,
} from '@store/roots/root-store-context';
import { useWidgetEditor } from '../WidgetSettings/WidgetEditorContext';
import { componentForWidget } from '@ui/widgets/registry';
import { WidgetInstanceScope } from '@ui/widgets/WidgetInstanceScope/WidgetInstanceScope';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import { ErrorBoundary } from '@ui/shared/ErrorBoundary';
import { widgetFrameStyle } from '@ui/app/widget-frame';
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
    const units = useUnitsStore();
    const { t } = useTranslation('main-app');

    const previewStore = useMemo(() => new PreviewCore(), []);

    useEffect(() => () => previewStore.dispose(), [previewStore]);

    useLayoutEffect(() => {
      seedScenario(previewStore, scenarioId);
    }, [previewStore, scenarioId]);

    useEffect(() => {
      seedInputHistory(previewStore);
    }, [previewStore, scenarioId]);

    // The preview store is its own world, units included — without this it
    // stays metric while the app is set to imperial, and every distance in the
    // preview contradicts the widget on the overlay.
    useLayoutEffect(() => {
      previewStore.units.setSystem(units.unitSystem);
    }, [previewStore, units.unitSystem]);

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

    const { userSettings, designWidth, autoHeight, overflowVisible } = widget;
    const widgetScale = userSettings.currentWidth / designWidth;
    const frameStyle = widgetFrameStyle({
      widgetType: widget ? widget.type : widgetId,
      userSettings,
      widgetScale,
      transparentContainer: widget.transparentContainer,
      autoHeight,
    });

    return (
      <RendererCoreContext.Provider value={previewStore}>
        <div className={styles.stage}>
          <div
            className={`${styles.widgetInner} ${
              overflowVisible ? styles.overflowVisible : ''
            }`}
            style={{
              width: userSettings.currentWidth,
              height: autoHeight ? 'auto' : userSettings.currentHeight,
              ...frameStyle,
            }}
          >
            <ErrorBoundary>
              <WidgetIdContext.Provider value={previewId}>
                <WidgetInstanceScope type={widget.type} instanceId={previewId}>
                  <Widget />
                </WidgetInstanceScope>
              </WidgetIdContext.Provider>
            </ErrorBoundary>
          </div>
        </div>
      </RendererCoreContext.Provider>
    );
  }
);
