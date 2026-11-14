import { useLayoutEffect } from 'react';
import { reaction, runInAction } from 'mobx';

import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { useSettingsMutationLog } from '@entities/layout/mutation-log-context';
import type { PreviewCoreHandle } from '@features/preview/preview-host-context';
import { useSeededPreviewWorld } from '@features/preview/use-seeded-preview-world';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import { useTrackRotationBridge } from './use-track-rotation-bridge';

// Mirror the full widget set from the main store into the isolated preview store
// so every widget on the canvas renders against sample telemetry while reflecting
// live edits. Positions/sizes are read from the main store directly by the
// canvas; only content-affecting settings need mirroring here.
const mirrorAllWidgets = (
  source: WidgetDefaultConfig[],
  previewStore: PreviewCoreHandle
) => {
  const mirrored = source.map((widget) => ({
    ...widget,
    userSettings: { ...widget.userSettings },
  }));

  // The preview world starts as the shipped catalog — one record per widget —
  // so a layout holding a copy has records it has never heard of. `syncWidgetSet`
  // reinstalls the list whenever the set of records changes, and patches it
  // field by field the rest of the time.
  previewStore.liveWidgets.syncWidgetSet(mirrored);
};

/**
 * The isolated world the canvas draws widget content in: built once per
 * canvas, seeded with the chosen scenario, kept in step with the main window's
 * widgets, units and track rotation, and disposed with the canvas.
 */
export const usePreviewWorld = (scenarioId: string) => {
  const liveWidgets = useMainLiveWidgetsStore();
  const settingsMutations = useSettingsMutationLog();
  const previewWorld = useSeededPreviewWorld(scenarioId);
  const previewStore = previewWorld.core;

  // The editor is the overlay in drag mode, seen from the main window, so the
  // widgets show the same in-place controls here — the track map's rotation
  // buttons among them.
  useLayoutEffect(() => {
    runInAction(() => {
      previewStore.appSettings.dragMode = true;
    });
  }, [previewStore]);

  useTrackRotationBridge(previewStore);

  useLayoutEffect(() => {
    mirrorAllWidgets(liveWidgets.allWidgets, previewStore);

    return reaction(
      () => settingsMutations.changeToken,
      () => mirrorAllWidgets(liveWidgets.allWidgets, previewStore)
    );
  }, [previewStore, liveWidgets, settingsMutations]);

  return previewWorld;
};
