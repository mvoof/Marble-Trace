import { comparer, reaction, type IReactionDisposer } from 'mobx';

import { pitAutoConfigOf } from '@features/pit-service/pit-auto-config';
import { setPitStrategySilent } from '@shared/api/pit.service';
import type { RendererCore } from '@app/roots/renderer-core';

/**
 * The main window's half of the pit service: telling the telemetry thread the
 * rules (`pitAutoConfigOf`).
 *
 * Registered after hydration, so the strategy pushed first is the user's rather
 * than the shipped defaults.
 */
export const registerPitServiceMainReactions = (
  root: RendererCore
): IReactionDisposer[] => [
  // The backend keeps the strategy across stream restarts, so one push per
  // change is enough.
  reaction(
    () =>
      pitAutoConfigOf(
        root.appSettings.appSettings,
        root.units.unitSystem,
        root.liveWidgets.isWidgetOnScreen('pit-service')
      ),
    (strategy) => setPitStrategySilent(strategy),
    { equals: comparer.structural, fireImmediately: true }
  ),
];
