import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { computedStore } from '../../../store/iracing/computed.store';
import { appSettingsStore } from '../../../store/app-settings.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type { DriverEntry } from '../../../types/bindings';
import { computeClassSof } from './standings-utils';
import { StandingsList } from './StandingsList/StandingsList';

const EMPTY_ENTRIES: DriverEntry[] = [];

export const StandingsWidget = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();
  const standings = computedStore.standings;
  const pitStops = computedStore.pitStops;

  const driverEntries = standings?.entries ?? EMPTY_ENTRIES;
  const overallSof = useMemo(
    () => computeClassSof(driverEntries),
    [driverEntries]
  );

  const allClassGroupsCount = useMemo(
    () => new Set(driverEntries.map((entry) => entry.carClassId)).size,
    [driverEntries]
  );

  const playerIncidents = useMemo(
    () => driverEntries.find((entry) => entry.isPlayer)?.incidents ?? 0,
    [driverEntries]
  );

  return (
    <StandingsList
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
