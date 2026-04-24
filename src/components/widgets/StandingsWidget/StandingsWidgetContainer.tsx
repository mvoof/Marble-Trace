import { observer } from 'mobx-react-lite';

import { computedStore, telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeClassSof } from './standings-utils';
import { StandingsWidget } from './StandingsWidget';

export const StandingsWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();
  const standings = computedStore.standings;
  const pitStops = computedStore.pitStops;

  const driverEntries = standings?.entries ?? [];

  const overallSof = computeClassSof(driverEntries);

  const irDeltaMap = settings.showIrChange
    ? new Map(
        driverEntries
          .filter((e) => e.estimatedIrDelta !== null)
          .map((e) => [e.carIdx, e.estimatedIrDelta as number])
      )
    : new Map<number, number>();

  return (
    <StandingsWidget
      driverEntries={driverEntries}
      settings={settings}
      irDeltaMap={irDeltaMap}
      playerPitStops={pitStops?.playerStops ?? 0}
      sessionInfo={telemetryStore.sessionInfo}
      weekendInfo={telemetryStore.weekendInfo}
      overallSof={overallSof}
    />
  );
});
