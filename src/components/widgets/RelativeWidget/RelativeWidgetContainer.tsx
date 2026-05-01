import { observer } from 'mobx-react-lite';

import { computedStore, telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { RelativeWidget } from './RelativeWidget';

const computeRelativeLapDist = (
  lapDistPct: number,
  playerLapDistPct: number
): number => {
  let diff = lapDistPct - playerLapDistPct;
  if (diff < -0.5) diff += 1.0;
  if (diff > 0.5) diff -= 1.0;
  return diff;
};

export const RelativeWidgetContainer = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();
  const standings = computedStore.standings;
  const carPositions = telemetryStore.carPositions;

  const playerIdx = standings?.entries.find((e) => e.isPlayer)?.carIdx ?? -1;
  const playerLapDist =
    carPositions && playerIdx >= 0
      ? (carPositions.car_idx_lap_dist_pct[playerIdx] ?? 0)
      : 0;

  const entries = [...(standings?.entries ?? [])]
    .map((e) => {
      if (!carPositions) return e;
      const lapDistPct =
        carPositions.car_idx_lap_dist_pct[e.carIdx] ?? e.lapDistPct;
      return {
        ...e,
        lapDistPct,
        relativeLapDist: computeRelativeLapDist(lapDistPct, playerLapDist),
      };
    })
    .sort((a, b) => b.relativeLapDist - a.relativeLapDist);

  return <RelativeWidget entries={entries} settings={settings} />;
});
