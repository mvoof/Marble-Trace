import { observer } from 'mobx-react-lite';
import {
  Flag,
  Road,
  ThermometerSun,
  Timer,
  TrafficCone,
  TriangleAlert,
  Wind,
} from 'lucide-react';

import { formatTemp, tempUnit } from '@shared/lib/telemetry-format';
import { parseWeekendTemp } from './session-bars-format';
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
import type { SessionBarSettings } from '@entities/session/session-bar-settings';

interface SessionFooterProps {
  settings: SessionBarSettings;
}

/**
 * The strip under the rows: track conditions at the left, the player's own
 * counts at the right, each a chip in the shape the rows use.
 */
export const SessionFooter = observer(({ settings }: SessionFooterProps) => {
  const {
    footerChipStyle: chipStyle,
    footerChipLabelMode,
    showAirTemp,
    showTrackTemp,
    showTrackWetness,
    showPitStops,
    showIncidentsBadge: showIncidents,
    showPenalties,
  } = settings;
  const useIcons = footerChipLabelMode === 'icon';
  const { pitStops, driverIdentities } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();
  const { unitSystem } = useUnitsStore();

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

  if (
    !(showAirTemp && airCelsius !== null) &&
    !(showTrackTemp && trkCelsius !== null) &&
    !(showTrackWetness && wetnessInfo) &&
    !showPitStops &&
    !showIncidents &&
    !(showPenalties && penaltyStatus)
  ) {
    return null;
  }

  return (
    <div className={styles.sessionFooter}>
      <div className={styles.footerGroup}>
        {showAirTemp && airCelsius !== null && (
          <StatChip
            presentation={chipStyle}
            tone="accent"
            lead="AIR"
            labelIcon={useIcons ? Wind : undefined}
            look="reading"
          >
            {`${formatTemp(airCelsius, unitSystem)}${tUnit}`}
          </StatChip>
        )}

        {showTrackTemp && trkCelsius !== null && (
          <StatChip
            presentation={chipStyle}
            tone="info"
            lead="TRACK"
            labelIcon={useIcons ? ThermometerSun : undefined}
            look="reading"
          >
            {`${formatTemp(trkCelsius, unitSystem)}${tUnit}`}
          </StatChip>
        )}

        {showTrackWetness && wetnessInfo && (
          <StatChip
            presentation={chipStyle}
            tone="accent"
            lead="SURFACE"
            labelIcon={useIcons ? Road : undefined}
            look="reading"
          >
            {wetnessInfo.label}
          </StatChip>
        )}
      </div>

      <div className={styles.footerGroup}>
        {showPitStops && (
          <StatChip
            presentation={chipStyle}
            lead="PIT"
            labelIcon={useIcons ? TrafficCone : undefined}
            look="reading"
            tone="accent"
          >
            {playerPitStops}
          </StatChip>
        )}

        {showIncidents && (
          <StatChip
            presentation={isNearLimit ? 'semantic' : chipStyle}
            look="reading"
            tone={isNearLimit ? 'danger' : 'accent'}
            lead="INC"
            labelIcon={useIcons ? TriangleAlert : undefined}
            limit={incidentLimit ?? undefined}
            valueDanger={isNearLimit}
          >
            {incidentLimit === null ? `${playerIncidents}x` : playerIncidents}
          </StatChip>
        )}

        {showPenalties && incidentsToPenalty !== null && (
          <StatChip
            presentation={isNearPenalty ? 'semantic' : chipStyle}
            look="reading"
            tone={isNearPenalty ? 'danger' : 'accent'}
            lead="TO PEN"
            labelIcon={useIcons ? Timer : undefined}
            valueDanger={isNearPenalty}
          >
            {incidentsToPenalty}
          </StatChip>
        )}

        {showPenalties && penaltyStatus && (
          <StatChip
            presentation={chipStyle}
            lead="PEN"
            labelIcon={useIcons ? Flag : undefined}
            look="reading"
            tone="accent"
          >
            {penaltyStatus.served}
          </StatChip>
        )}
      </div>
    </div>
  );
});
