import { useEffect, useLayoutEffect, useMemo } from 'react';

import { useUnitsStore } from '@entities/app-settings/units-context';

import { seedInputHistory } from './preview-animator';
import { usePreviewWorldFactory } from './preview-host-context';
import { seedScenario } from './scenarios';

/**
 * A fresh sample world for a page that draws widgets: seeded with the
 * scenario, in the app's units, disposed with the page. What the world holds
 * beyond the catalog is the page's to mirror.
 */
export const useSeededPreviewWorld = (scenarioId: string) => {
  const units = useUnitsStore();
  const createPreviewWorld = usePreviewWorldFactory();
  const previewWorld = useMemo(
    () => createPreviewWorld(),
    [createPreviewWorld]
  );
  const previewStore = previewWorld.core;

  useEffect(() => () => previewStore.dispose(), [previewStore]);

  // The preview store carries its own units; without this it stays metric
  // while the app is set to imperial, and every distance in the preview
  // contradicts the widget on the overlay.
  useLayoutEffect(() => {
    previewStore.units.setSystem(units.unitSystem);
  }, [previewStore, units.unitSystem]);

  useLayoutEffect(() => {
    seedScenario(previewStore, scenarioId);
  }, [previewStore, scenarioId]);

  useEffect(() => {
    seedInputHistory(previewStore);
  }, [previewStore, scenarioId]);

  return previewWorld;
};
