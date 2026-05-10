import { useMemo } from 'react';

import { observer } from 'mobx-react-lite';

import { DriverEntry } from '../../../types/bindings';
import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { computedStore } from '../../../store/iracing/computed.store';
import { appSettingsStore } from '../../../store/app-settings.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeClassSof } from './standings-utils';
import { StandingsWidget } from './StandingsWidget';

const EMPTY_ENTRIES: DriverEntry[] = [];

export const StandingsWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();
  const standings = computedStore.standings;
  const pitStops = computedStore.pitStops;

  const driverEntries = useMemo(
    () => standings?.entries ?? EMPTY_ENTRIES,
    [standings]
  );

  const overallSof = useMemo(
    () => computeClassSof(driverEntries),
    [driverEntries]
  );

  const allClassGroupsCount = useAllClassGroupsCount(driverEntries);

  const irDeltaMap = useMemo(
    () =>
      settings.showIrChange
        ? new Map(
            driverEntries
              .filter((e) => e.estimatedIrDelta !== null)
              .map((e) => [e.carIdx, e.estimatedIrDelta as number])
          )
        : new Map<number, number>(),

    [driverEntries, settings.showIrChange]
  );

  // Race: use grid positions from QualifyResultsInfo. Practice/time-trial: falls back to first-frame snapshot in computedStore
  const qualifyResults =
    telemetryStore.sessionInfo?.QualifyResultsInfo?.Results ?? null;

  const qualifyStartPosMap = useMemo(() => {
    if (!qualifyResults || qualifyResults.length === 0) return null;

    const map = new Map<number, { overall: number; class: number }>();
    for (const r of qualifyResults) {
      if (r.CarIdx != null && r.Position != null) {
        map.set(r.CarIdx, {
          overall: r.Position + 1,
          class: (r.ClassPosition ?? r.Position) + 1,
        });
      }
    }

    return map.size > 0 ? map : null;
  }, [qualifyResults]);

  const effectiveStartPosMap = useMemo(
    () =>
      new Map(
        driverEntries.map((e) => [
          e.carIdx,
          qualifyStartPosMap?.get(e.carIdx) ??
            computedStore.getEffectiveStartPos(e.carIdx),
        ])
      ),

    [driverEntries, qualifyStartPosMap]
  );

  const playerIncidents = useMemo(
    () => driverEntries.find((e) => e.isPlayer)?.incidents ?? 0,
    [driverEntries]
  );

  return (
    <StandingsWidget
      driverEntries={driverEntries}
      settings={settings}
      irDeltaMap={irDeltaMap}
      effectiveStartPosMap={effectiveStartPosMap}
      playerPitStops={pitStops?.playerStops ?? 0}
      playerIncidents={playerIncidents}
      sessionInfo={telemetryStore.sessionInfo}
      weekendInfo={telemetryStore.weekendInfo}
      overallSof={overallSof}
      activeClassIndex={widgetSettingsStore.standingsActiveClassIndex}
      dragMode={appSettingsStore.dragMode}
      onPrevClass={() =>
        widgetSettingsStore.cycleStandingsPrev(allClassGroupsCount)
      }
      onNextClass={() =>
        widgetSettingsStore.cycleStandingsNext(allClassGroupsCount)
      }
    />
  );
});

const useAllClassGroupsCount = (driverEntries: DriverEntry[]) => {
  return useMemo(
    () => new Set(driverEntries.map((e) => e.carClassId)).size,
    [driverEntries]
  );
};
