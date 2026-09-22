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
// absence of a forced state rather than a state of its own, and leaving it out
// stranded the driver on the first scenario they picked, with nothing to pick
// to get back.
//
// Unless the widget says the baseline is not one of its states at all — the
// baseline car is a GT3, and a widget reading hardware it does not carry draws
// nothing against it. Offering that is offering an empty pane.
const scenarioOptionsFor = (widgetId: string) => {
  const manifest = WIDGET_BY_ID.get(widgetId);
  const declared = manifest?.previewScenarios ?? [];

  if (declared.length === 0) {
    return [];
  }

  const baseline =
    manifest?.previewBaseline === false
      ? []
      : scenarioOption(DEFAULT_PREVIEW_SCENARIO_ID);

  return [
    ...baseline,
    ...declared
      .filter((scenarioId) => scenarioId !== DEFAULT_PREVIEW_SCENARIO_ID)
      .flatMap(scenarioOption),
  ];
};

// What a widget opens on: the first state it declares, not the baseline.
//
// A manifest declares scenarios because those are the states the widget is
// worth looking at in, and some widgets cannot draw the baseline at all — it is
// a GT3, so the battery and the hybrid readouts render nothing against it and
// the pane opens blank on a widget the driver just clicked to look at. The
// baseline still leads the picker, one click away.
const openingScenarioFor = (widgetId: string): string =>
  WIDGET_BY_ID.get(widgetId)?.previewScenarios?.[0] ??
  DEFAULT_PREVIEW_SCENARIO_ID;

// Two-pane widget catalog workspace: live preview column on the left, widget
// settings panel on the right. The parent owns which widget is active,
// including the default-to-first fallback.
export const WidgetWorkbench = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    const { t } = useTranslation('main-app');
    // Pinned to the widget it was picked on: a pick says "show me this state of
    // this widget", and carrying it to the next widget shows another domain's
    // state or, on a widget that cannot draw it, nothing at all.
    const [picked, setPicked] = useState<{
      widgetId: string;
      scenarioId: string;
    } | null>(null);

    if (!widgetId) {
      return (
        <div className={styles.empty}>{t('widgetWorkbench.noWidgets')}</div>
      );
    }

    const scenarioOptions = scenarioOptionsFor(widgetId);
    const isPickedHere =
      picked?.widgetId === widgetId &&
      scenarioOptions.some((option) => option.value === picked.scenarioId);
    const activeScenarioId = isPickedHere
      ? picked.scenarioId
      : openingScenarioFor(widgetId);

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
                  onChange={(scenarioId) => setPicked({ widgetId, scenarioId })}
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
