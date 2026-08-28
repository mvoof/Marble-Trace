import { observer } from 'mobx-react-lite';
import { Wrench, Thermometer, Waves, TriangleAlert } from 'lucide-react';

import { formatTemp, tempUnit } from '@utils/telemetry-format';
import { parseWeekendTemp } from '@ui/widgets/StandingsWidget/standings-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/colors';
import { getTrackWetnessInfo } from '@utils/weather-utils';
import { isNearIncidentLimit } from '@utils/driver';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { StatPill } from '@ui/shared/StatPill/StatPill';
import styles from './SessionFooter.module.scss';
import {
  useBackendComputedStore,
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SessionFooter = observer(() => {
  const { pitStops, driverEntries: driverEntriesFrame } =
    useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const showWeather = settings.showWeather;
  const showPitStops = settings.showPitStops;
  const showIncidents = settings.showIncidentsBadge;

  if (!showWeather && !showPitStops && !showIncidents) {
    return null;
  }

  const driverEntries = driverEntriesFrame?.entries ?? [];

  const playerIncidents =
    driverEntries.find((entry) => entry.isPlayer)?.incidents ?? 0;

  // Null in practice and most hosted sessions, where incidents are uncapped.
  const incidentLimit = sessionInfo?.incidentLimit ?? null;
  const isNearLimit = isNearIncidentLimit(playerIncidents, incidentLimit);

  const playerPitStops = pitStops?.playerStops ?? 0;

  const airCelsius =
    environment?.airTemp ?? parseWeekendTemp(sessionInfo?.trackAirTemp);

  const trkCelsius =
    environment?.trackTemp ?? parseWeekendTemp(sessionInfo?.trackSurfaceTemp);

  const tUnit = tempUnit(unitSystem);

  const airStr =
    airCelsius !== null
      ? `${formatTemp(airCelsius, unitSystem)}${tUnit}`
      : null;

  const trkStr =
    trkCelsius !== null
      ? `${formatTemp(trkCelsius, unitSystem)}${tUnit}`
      : null;

  const wetnessInfo = getTrackWetnessInfo(environment?.trackWetness);

  return (
    <div className={styles.sessionFooter}>
      <div className={styles.footerLeft}>
        {showPitStops && (
          <StatPill icon={Wrench} label="PIT">
            {playerPitStops}
          </StatPill>
        )}

        {showIncidents && (
          <StatPill
            icon={TriangleAlert}
            iconTone={isNearLimit ? 'danger' : 'warning'}
            label="INC"
            valueDanger={isNearLimit}
            pulse={isNearLimit}
          >
            {incidentLimit === null
              ? `${playerIncidents}x`
              : `${playerIncidents}/${incidentLimit}x`}
          </StatPill>
        )}
      </div>

      <div className={styles.footerRight}>
        {showWeather && airCelsius !== null && airStr && (
          <StatPill
            icon={Thermometer}
            iconColor={getAirTempColor(airCelsius)}
            label="AIR"
          >
            {airStr}
          </StatPill>
        )}

        {showWeather && trkCelsius !== null && trkStr && (
          <StatPill
            icon={Thermometer}
            iconColor={getTrackTempColor(trkCelsius)}
            label="TRACK"
          >
            {trkStr}
          </StatPill>
        )}

        {showWeather && wetnessInfo && (
          <StatPill icon={Waves} iconColor={wetnessInfo.color} label="SURFACE">
            {wetnessInfo.label}
          </StatPill>
        )}
      </div>
    </div>
  );
});
