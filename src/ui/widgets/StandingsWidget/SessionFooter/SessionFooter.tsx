import { observer } from 'mobx-react-lite';
import { Wrench, Thermometer, Waves } from 'lucide-react';

import { formatTemp, tempUnit } from '@utils/telemetry-format';
import { parseWeekendTemp } from '@ui/widgets/StandingsWidget/standings-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/colors';
import { getTrackWetnessInfo } from '@utils/weather-utils';

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
  const { pitStops } = useBackendComputedStore();
  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();
  const { unitSystem } = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const showWeather = settings.showWeather;
  const showPitStops = settings.showPitStops;

  if (!showWeather && !showPitStops) {
    return null;
  }

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
