import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { formatTemp, tempUnit } from '@shared/lib/telemetry-format';
import { parseWeekendTemp } from '@widgets/standings/standings-utils';
import { getTrackWetnessInfo } from '@shared/lib/weather-utils';
import {
  getIncidentPenaltyStatus,
  isNearIncidentLimit,
  isNearIncidentPenalty,
} from '@shared/lib/driver';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import styles from './SessionFooter.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useEnvironmentStore } from '@entities/environment/environment-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import type { StandingsWidgetSettings } from '../settings-schema';

/**
 * The strip under the rows: track conditions at the left, the player's own
 * counts at the right, each a chip in the shape the rows use.
 */
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

  const incidentsToPenalty =
    penaltyStatus?.nextAt == null
      ? null
      : Math.max(0, penaltyStatus.nextAt - playerIncidents);

  const playerPitStops = pitStops?.playerStops ?? 0;

  const airCelsius =
    environment?.airTemp ?? parseWeekendTemp(sessionInfo?.trackAirTemp);

  const trkCelsius =
    environment?.trackTemp ?? parseWeekendTemp(sessionInfo?.trackSurfaceTemp);

  const tUnit = tempUnit(unitSystem);

  const wetnessInfo = getTrackWetnessInfo(environment?.trackWetness);

  return (
    <div className={styles.sessionFooter}>
      <div className={styles.footerGroup}>
        {showWeather && airCelsius !== null && (
          <StatChip tone="accent" lead="AIR" leadVariant="solid">
            {`${formatTemp(airCelsius, unitSystem)}${tUnit}`}
          </StatChip>
        )}

        {showWeather && trkCelsius !== null && (
          <StatChip tone="info" lead="TRACK" leadVariant="solid">
            {`${formatTemp(trkCelsius, unitSystem)}${tUnit}`}
          </StatChip>
        )}

        {showWeather && wetnessInfo && (
          <StatChip tone="accent" lead="SURFACE" leadVariant="solid">
            {wetnessInfo.label}
          </StatChip>
        )}
      </div>

      <div className={styles.footerGroup}>
        {showPitStops && (
          <StatChip lead="PIT" leadVariant="solid" tone="accent">
            {playerPitStops}
          </StatChip>
        )}

        {showIncidents && (
          <StatChip
            leadVariant="solid"
            tone={isNearLimit ? 'danger' : 'accent'}
            lead="INC"
            limit={incidentLimit ?? undefined}
            valueDanger={isNearLimit}
            emphasized={isNearLimit}
          >
            {incidentLimit === null ? `${playerIncidents}x` : playerIncidents}
          </StatChip>
        )}

        {showIncidents && incidentsToPenalty !== null && (
          <StatChip
            leadVariant="solid"
            tone={isNearPenalty ? 'danger' : 'accent'}
            lead="TO PEN"
            valueDanger={isNearPenalty}
            emphasized={isNearPenalty}
          >
            {incidentsToPenalty}
          </StatChip>
        )}

        {showIncidents && penaltyStatus && (
          <StatChip lead="PEN" leadVariant="solid" tone="accent">
            {penaltyStatus.served}
          </StatChip>
        )}
      </div>
    </div>
  );
});
