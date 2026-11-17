import { observer } from 'mobx-react-lite';
import { WidgetPreview } from '../WidgetPreview/WidgetPreview';
import { WidgetSettings } from '@features/widget-settings/WidgetSettings';
import { DefaultsEditorProvider } from '@features/widget-settings/WidgetEditorContext';
import { WidgetBindingsSummary } from '@features/hotkey-bindings/WidgetBindingsSummary';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import type { WidgetPreviewPosition } from '@entities/app-settings/app-settings.store';
import styles from './WidgetWorkbench.module.scss';

// One widget's page: the live preview on top (or to the left), held in view
// while the settings scroll. The parent owns which widget is active, the
// scenario it draws and where the preview goes.
export const WidgetWorkbench = observer(
  ({
    widgetId,
    scenarioId,
    previewPosition,
  }: {
    widgetId: string;
    scenarioId: string;
    previewPosition: WidgetPreviewPosition;
  }) => {
    const navigation = useMainNavigationStore();

    return (
      <DefaultsEditorProvider>
        <div
          className={
            previewPosition === 'left' ? styles.rootPreviewLeft : styles.root
          }
        >
          <div className={styles.previewColumn}>
            <div className={styles.previewPane}>
              <WidgetPreview
                key={widgetId}
                widgetId={widgetId}
                scenarioId={scenarioId}
              />
            </div>
          </div>

          <div className={styles.settingsPane}>
            {/* The page edits the widget's defaults, not a copy: the copy's
                hotkey mark is set where copies are, in the layout editor. */}
            <WidgetSettings
              widgetId={widgetId}
              hideHeader
              openCards
              hotkeys={
                <WidgetBindingsSummary
                  widgetType={widgetId}
                  onOpenHotkeys={() => navigation.openHotkeys(widgetId)}
                />
              }
            />
          </div>
        </div>
      </DefaultsEditorProvider>
    );
  }
);
