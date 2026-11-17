import {
  PREVIEW_SCENARIO_BY_ID,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@features/preview/scenarios';
import { WIDGET_BY_ID } from '@entities/widget/widget-catalog';

export interface ScenarioOption {
  value: string;
  label: string;
}

const scenarioOption = (scenarioId: string): ScenarioOption[] => {
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
export const scenarioOptionsFor = (widgetId: string): ScenarioOption[] => {
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
export const openingScenarioFor = (widgetId: string): string =>
  WIDGET_BY_ID.get(widgetId)?.previewScenarios?.[0] ??
  DEFAULT_PREVIEW_SCENARIO_ID;
