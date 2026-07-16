import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Select } from 'antd';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { WidgetPreview } from '../WidgetPreview/WidgetPreview';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { DefaultsEditorProvider } from '../WidgetSettings/WidgetEditorContext';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import styles from './WidgetWorkbench.module.scss';

const SCENARIO_OPTIONS = PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

// Two-pane widget catalog workspace: live preview column on the left, widget
// settings panel on the right. Auto-selects the first widget by default if
// none is selected.
export const WidgetWorkbench = observer(
  ({
    widgetId,
    onSelectWidget,
  }: {
    widgetId: string | null;
    onSelectWidget?: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');
    const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

    useEffect(() => {
      if (!widgetId && widgetSettings.allWidgets.length > 0 && onSelectWidget) {
        onSelectWidget(widgetSettings.allWidgets[0].id);
      }
    }, [widgetId, widgetSettings.allWidgets, onSelectWidget]);

    const activeWidgetId =
      widgetId || (widgetSettings.allWidgets[0]?.id ?? null);

    if (!activeWidgetId) {
      return (
        <div className={styles.empty}>{t('widgetWorkbench.noWidgets')}</div>
      );
    }

    return (
      <DefaultsEditorProvider>
        <div className={styles.root}>
          <div className={styles.previewColumn}>
            <div className={styles.scenarioBar}>
              <span className={styles.scenarioLabel}>
                {t('widgetWorkbench.scenario')}
              </span>
              <Select
                size="small"
                value={scenarioId}
                onChange={setScenarioId}
                options={SCENARIO_OPTIONS}
                style={{ minWidth: 160 }}
                popupMatchSelectWidth={false}
              />
            </div>

            <div className={styles.previewPane}>
              <WidgetPreview
                key={activeWidgetId}
                widgetId={activeWidgetId}
                scenarioId={scenarioId}
              />
            </div>
          </div>

          <div className={styles.settingsPane}>
            <WidgetSettings widgetId={activeWidgetId} />
          </div>
        </div>
      </DefaultsEditorProvider>
    );
  }
);
