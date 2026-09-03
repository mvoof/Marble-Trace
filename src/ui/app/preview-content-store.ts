import { useEffect, useLayoutEffect, useState } from 'react';
import { reaction, runInAction } from 'mobx';

import { RootStore } from '@store/root-store';
import { seedScenario } from '@store/preview/scenarios';
import { seedInputHistory } from '@store/preview/preview-animator';
import {
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

/**
 * Copies the widget set into an isolated store so the widgets drawn against it
 * render the driver's own settings over sample telemetry. Geometry is never
 * mirrored — the frame that hosts the widget reads position and size from the
 * real store, and writes the drag straight back to it.
 */
export const mirrorWidgetsIntoPreview = (
  source: WidgetDefaultConfig[],
  previewStore: RootStore
) => {
  // The whole set rather than a patch: the preview world starts as the shipped
  // catalog, so a layout holding a copy has records it has never heard of, and
  // a patch would leave the copy drawing another widget's settings.
  previewStore.widgetSettings.syncWidgetSet(
    source.map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }))
  );
};

/**
 * The store a window renders widget *content* against while the driver is
 * placing widgets and the sim is not running.
 *
 * A widget only draws the blocks its data gives it, so with the game closed
 * half of every widget is missing — and the half that is missing is exactly the
 * part the driver is trying to leave room for. The layout editor has always
 * solved this by rendering against sample telemetry; this is the same store for
 * the overlay's own edit mode, so both show the widget the size it runs at.
 *
 * Returns `null` while inactive, and the caller renders against the real store.
 * With the sim connected there is nothing to stand in for: the live frames are
 * the truth, and seeding over them would show the driver a race they are not in.
 *
 * The store is built on first use and kept afterwards — leaving and re-entering
 * edit mode is a keystroke, and rebuilding a whole `RootStore` on it would
 * restart every widget's animation.
 */
export const usePreviewContentStore = (active: boolean): RootStore | null => {
  const widgetSettings = useWidgetSettingsStore();
  const units = useUnitsStore();

  const [previewStore, setPreviewStore] = useState<RootStore | null>(null);

  useEffect(() => {
    if (!active || previewStore) return;

    setPreviewStore(new RootStore({ skipInit: true }));
  }, [active, previewStore]);

  useEffect(() => () => previewStore?.dispose(), [previewStore]);

  useLayoutEffect(() => {
    if (!previewStore) return;

    // The widgets carry the same in-place controls here as they do on the
    // overlay, and they read that flag from whichever store is in context.
    runInAction(() => {
      previewStore.appSettings.dragMode = true;
    });

    seedScenario(previewStore);
    seedInputHistory(previewStore);
  }, [previewStore]);

  useLayoutEffect(() => {
    if (!previewStore) return;

    previewStore.units.setSystem(units.unitSystem);
  }, [previewStore, units.unitSystem]);

  useLayoutEffect(() => {
    if (!previewStore) return;

    mirrorWidgetsIntoPreview(widgetSettings.allWidgets, previewStore);

    return reaction(
      () => [widgetSettings.changeToken, widgetSettings.syncToken],
      () => mirrorWidgetsIntoPreview(widgetSettings.allWidgets, previewStore)
    );
  }, [previewStore, widgetSettings]);

  return active ? previewStore : null;
};
