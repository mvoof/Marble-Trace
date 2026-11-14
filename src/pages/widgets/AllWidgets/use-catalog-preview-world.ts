import { useLayoutEffect } from 'react';
import { reaction } from 'mobx';

import { useWidgetDefaultsStore } from '@entities/widget/widget-defaults-context';
import { DEFAULT_PREVIEW_SCENARIO_ID } from '@features/preview/scenarios';
import { useSeededPreviewWorld } from '@features/preview/use-seeded-preview-world';

/**
 * One sample world every miniature of All widgets draws in, holding the
 * Widgets page's records, so a miniature shows the widget as it is set up.
 */
export const useCatalogPreviewWorld = () => {
  const widgetDefaults = useWidgetDefaultsStore();
  const previewWorld = useSeededPreviewWorld(DEFAULT_PREVIEW_SCENARIO_ID);
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
