import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Select } from 'antd';
import { WidgetPreview } from '../WidgetPreview/WidgetPreview';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import styles from './WidgetWorkbench.module.scss';

const SCENARIO_OPTIONS = PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

// Two-pane widget catalog: a live preview on a backdrop on the left, the widget
// settings panel on the right. Editing the panel updates the preview in place.
// The scenario selector forces a specific telemetry state (flags, radar traffic,
// rain, badges, …) so any widget state is reproducible on demand.
export const WidgetWorkbench = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

    if (!widgetId) {
      return (
        <div className={styles.empty}>
          Select a widget to preview & configure
        </div>
      );
    }

    return (
      <div className={styles.root}>
        <div className={styles.previewColumn}>
          <div className={styles.scenarioBar}>
            <span className={styles.scenarioLabel}>Scenario</span>
            <Select
              size="small"
              value={scenarioId}
              onChange={setScenarioId}
              options={SCENARIO_OPTIONS}
              style={{ minWidth: 160 }}
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
    );
  }
);
