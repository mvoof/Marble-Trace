import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Select } from 'antd';
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
// settings panel on the right. The parent owns which widget is active,
// including the default-to-first fallback.
export const WidgetWorkbench = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    const { t } = useTranslation('main-app');
    const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

    if (!widgetId) {
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
                key={widgetId}
                widgetId={widgetId}
                scenarioId={scenarioId}
              />
            </div>
          </div>

          <div className={styles.settingsPane}>
            <WidgetSettings widgetId={widgetId} />
          </div>
        </div>
      </DefaultsEditorProvider>
    );
  }
);
