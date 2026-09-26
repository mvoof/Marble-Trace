import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { Wrench, Thermometer, Waves, TriangleAlert, Gavel } from 'lucide-react';

import { formatTemp, tempUnit } from '@utils/telemetry-format';
import { parseWeekendTemp } from '@ui/widgets/StandingsWidget/standings-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/colors';
import { getTrackWetnessInfo } from '@utils/weather-utils';
import {
  getIncidentPenaltyStatus,
  isNearIncidentLimit,
  isNearIncidentPenalty,
} from '@utils/driver';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { StatPill, type StatPillVariant } from '@ui/shared/StatPill/StatPill';
import styles from './SessionFooter.module.scss';
import {
  useBackendComputedStore,
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

// Boxed chips would make the strip taller than the rows it sits under, which is
// the one thing the footer must not be.
const PILL_VARIANT: StatPillVariant = 'inline';

export const SessionFooter = observer(() => {
  const { pitStops, driverIdentities } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();
  const { unitSystem } = useUnitsStore();

  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  const showWeather = settings.showWeather;
  const showPitStops = settings.showPitStops;
  const showIncidents = settings.showIncidentsBadge;

  if (!showWeather && !showPitStops && !showIncidents) {
    return null;
  }

  const playerIncidents =
    driverIdentities.find((entry) => entry.isPlayer)?.incidents ?? 0;

  // Null in practice and most hosted sessions, where incidents are uncapped.
  const incidentLimit = sessionInfo?.incidentLimit ?? null;
  const isNearLimit = isNearIncidentLimit(playerIncidents, incidentLimit);

  // Sessions with a drive-through every N incidents, whether or not they also
  // disqualify. Null when the session hands out no penalties.
  const penaltyStatus = getIncidentPenaltyStatus(playerIncidents, {
    initial: sessionInfo?.incidentPenaltyInitial ?? null,
    subsequent: sessionInfo?.incidentPenaltySubsequent ?? null,
    limit: incidentLimit,
  });
  const isNearPenalty = isNearIncidentPenalty(playerIncidents, penaltyStatus);

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
        {showWeather && airCelsius !== null && airStr && (
          <StatPill
            icon={Thermometer}
            iconColor={getAirTempColor(airCelsius)}
            label="AIR"
            variant={PILL_VARIANT}
          >
            {airStr}
          </StatPill>
        )}

        {showWeather && trkCelsius !== null && trkStr && (
          <StatPill
            icon={Thermometer}
            iconColor={getTrackTempColor(trkCelsius)}
            label="TRACK"
            variant={PILL_VARIANT}
          >
            {trkStr}
          </StatPill>
        )}
      </div>

      <div className={styles.footerCenter}>
        {showPitStops && (
          <StatPill
            icon={Wrench}
            iconTone="accent"
            label="PIT"
            variant={PILL_VARIANT}
          >
            {playerPitStops}
          </StatPill>
        )}

        {showIncidents && (
          <StatPill
            icon={TriangleAlert}
            iconTone={isNearLimit ? 'danger' : 'warning'}
            label="INC"
            variant={PILL_VARIANT}
            valueDanger={isNearLimit}
            pulse={isNearLimit}
          >
            {incidentLimit === null
              ? `${playerIncidents}x`
              : `${playerIncidents}/${incidentLimit}x`}
          </StatPill>
        )}

        {showIncidents && penaltyStatus && (
          <StatPill
            icon={Gavel}
            iconTone={isNearPenalty ? 'danger' : 'warning'}
            label="PEN"
            variant={PILL_VARIANT}
            valueDanger={isNearPenalty}
          >
            {penaltyStatus.nextAt === null
              ? `${penaltyStatus.served}`
              : `${penaltyStatus.served} · ${penaltyStatus.nextAt}x`}
          </StatPill>
        )}
      </div>

      <div className={styles.footerRight}>
        {showWeather && wetnessInfo && (
          <StatPill
            icon={Waves}
            iconColor={wetnessInfo.color}
            label="SURFACE"
            variant={PILL_VARIANT}
          >
            {wetnessInfo.label}
          </StatPill>
        )}
      </div>
    </div>
  );
});
