import { useLayoutEffect } from 'react';
import { reaction } from 'mobx';

import { useWidgetDefaultsStore } from '@entities/widget/widget-defaults-context';
import { DEFAULT_PREVIEW_SCENARIO_ID } from '@features/preview/scenarios';
import { useSeededPreviewWorld } from '@features/preview/use-seeded-preview-world';

/**
 * A sample world All widgets' miniatures draw in, holding the Widgets page's
 * records, so a miniature shows the widget as it is set up. The grid shares
 * one on the baseline; a widget the baseline leaves blank gets its own.
 */
export const useCatalogPreviewWorld = (
  scenarioId: string = DEFAULT_PREVIEW_SCENARIO_ID
) => {
  const widgetDefaults = useWidgetDefaultsStore();
  const previewWorld = useSeededPreviewWorld(scenarioId);
  const previewStore = previewWorld.core;

  useLayoutEffect(
    () =>
      reaction(
        () => widgetDefaults.catalogWidgets,
        (widgets) =>
          previewStore.liveWidgets.syncWidgetSet(
            widgets.map((widget) => ({
              ...widget,
              userSettings: { ...widget.userSettings },
            }))
          ),
        { fireImmediately: true }
      ),
    [previewStore, widgetDefaults]
  );

  return previewWorld;
};
