import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Select } from 'antd';
import { WidgetPreview } from '../WidgetPreview/WidgetPreview';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { DefaultsEditorProvider } from '../WidgetSettings/WidgetEditorContext';
import {
  PREVIEW_SCENARIO_BY_ID,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import { WIDGET_BY_ID } from '@store/widget-catalog';
import styles from './WidgetWorkbench.module.scss';

const scenarioOption = (scenarioId: string) => {
  const scenario = PREVIEW_SCENARIO_BY_ID.get(scenarioId);

  return scenario ? [{ value: scenario.id, label: scenario.label }] : [];
};

// A widget offers the scenarios its own manifest declares, and nothing else.
// One that declares none has no states of its own to switch between, so it gets
// no picker at all — its preview still renders against the base snapshot.
//
// The baseline leads the list without being declared anywhere: it is the
// absence of a forced state rather than a state of its own, and it is what the
// picker opens on — leaving it out stranded the driver on the first scenario
// they picked, with nothing to pick to get back.
const scenarioOptionsFor = (widgetId: string) => {
  const declared = WIDGET_BY_ID.get(widgetId)?.previewScenarios ?? [];

  if (declared.length === 0) {
    return [];
  }

  return [
    ...scenarioOption(DEFAULT_PREVIEW_SCENARIO_ID),
    ...declared
      .filter((scenarioId) => scenarioId !== DEFAULT_PREVIEW_SCENARIO_ID)
      .flatMap(scenarioOption),
  ];
};

// Two-pane widget catalog workspace: live preview column on the left, widget
// settings panel on the right. The parent owns which widget is active,
// including the default-to-first fallback.
export const WidgetWorkbench = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    const { t } = useTranslation('main-app');
    const [scenarioId, setScenarioId] = useState<string>(
      DEFAULT_PREVIEW_SCENARIO_ID
    );

    if (!widgetId) {
      return (
        <div className={styles.empty}>{t('widgetWorkbench.noWidgets')}</div>
      );
    }

    const scenarioOptions = scenarioOptionsFor(widgetId);
    // The picked id belongs to whichever widget was open when it was picked, so
    // a widget that does not declare it falls back to the base snapshot rather
    // than showing another domain's state.
    const isDeclared = scenarioOptions.some(
      (option) => option.value === scenarioId
    );
    const activeScenarioId = isDeclared
      ? scenarioId
      : DEFAULT_PREVIEW_SCENARIO_ID;

    return (
      <DefaultsEditorProvider>
        <div className={styles.root}>
          <div className={styles.previewColumn}>
            {scenarioOptions.length > 0 && (
              <div className={styles.scenarioBar}>
                <span className={styles.scenarioLabel}>
                  {t('widgetWorkbench.scenario')}
                </span>
                <Select
                  size="small"
                  value={activeScenarioId}
                  onChange={setScenarioId}
                  options={scenarioOptions}
                  style={{ minWidth: 160 }}
                  popupMatchSelectWidth={false}
                />
              </div>
            )}

            <div className={styles.previewPane}>
              <WidgetPreview
                key={widgetId}
                widgetId={widgetId}
                scenarioId={activeScenarioId}
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
