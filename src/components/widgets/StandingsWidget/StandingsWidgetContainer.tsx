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

  const playerIncidents = useMemo(
    () => driverEntries.find((e) => e.isPlayer)?.incidents ?? 0,
    [driverEntries]
  );

  return (
    <StandingsWidget
      driverEntries={driverEntries}
      settings={settings}
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
