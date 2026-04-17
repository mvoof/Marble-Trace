import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { pitStopsStore } from '../../../store/pit-stops.store';
import { computeProjectedIrDelta } from '../../../utils/iracing-irating';
import { computeStandingsEntries, computeClassSof } from './standings-utils';
import { StandingsWidget } from './StandingsWidget';

export const StandingsWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();

  const driverEntries = computeStandingsEntries(
    telemetryStore.carIdx,
    telemetryStore.driverInfo,
    telemetryStore.startPositions
  );

  const overallSof = computeClassSof(driverEntries);

  const irDeltaMap = settings.showIrChange
    ? computeProjectedIrDelta(
        driverEntries.map((d) => ({
          carIdx: d.carIdx,
          classId: d.carClassId,
          classPosition: d.classPosition,
          iRating: d.iRating,
        }))
      )
    : new Map<number, number>();

  return (
    <StandingsWidget
      driverEntries={driverEntries}
      settings={settings}
      irDeltaMap={irDeltaMap}
      playerPitStops={pitStopsStore.playerStops}
      sessionInfo={telemetryStore.sessionInfo}
      weekendInfo={telemetryStore.weekendInfo}
      overallSof={overallSof}
    />
  );
});
