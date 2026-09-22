import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { convertTemp, tempUnit } from '@utils/telemetry-format';
import { parseWeekendFloat, getSkiesLabel } from '@utils/weather-utils';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

import { weatherIconFor } from '../weather-icons';
import styles from './HorizontalCondition.module.scss';

const ICON_SIZE_PX = 34;

export const HorizontalCondition = observer(() => {
  const { unitSystem } = useUnitsStore();
  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();

  const { showAirTemp } = useWidgetSettings<WeatherWidgetSettings>('weather');

  const airTempC =
    environment?.airTemp ?? parseWeekendFloat(sessionInfo?.trackAirTemp);
  const WeatherIcon = weatherIconFor(
    environment?.skies,
    environment?.trackWetness
  );

  return (
    <div className={styles.condition}>
      <div className={styles.skiesRow}>
        <WeatherIcon size={ICON_SIZE_PX} className={styles.icon} />

        <span className={styles.skiesText}>
          {getSkiesLabel(environment?.skies)}
        </span>
      </div>

      {showAirTemp && airTempC != null && (
        <span className={styles.airTemp}>
          {Math.round(convertTemp(airTempC, unitSystem))}

          <span className={styles.airTempUnit}>{tempUnit(unitSystem)}</span>
        </span>
      )}
    </div>
  );
});
