import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../../store/units.store';
import { formatTemp, tempUnit } from '../../../../utils/telemetry-format';
import { formatWindSpeed, parseWeekendFloat } from '../weather-utils';

import styles from './StatCell.module.scss';

export type StatCellType = 'airTemp' | 'trackTemp' | 'wind' | 'humidity';

const getWindColor = (mps: number | null): string => {
  if (mps === null) return '#3399ff';
  if (mps > 8) return '#ef4444';
  if (mps > 4) return '#ffcc00';

  return '#3399ff';
};

interface StatCellProps {
  type: StatCellType;
}

export const StatCell = observer(({ type }: StatCellProps) => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const { system } = unitsStore;

  let label = '';
  let value = '';
  let unit: string | undefined;
  let color = '#fff';
  let wide = false;

  if (type === 'airTemp') {
    const airTempC =
      env?.air_temp ?? parseWeekendFloat(weekendInfo?.TrackAirTemp);

    label = 'AIR';
    value = formatTemp(airTempC, system);
    unit = tempUnit(system);
    color = '#fff';
  } else if (type === 'trackTemp') {
    const trackTempC =
      env?.track_temp ?? parseWeekendFloat(weekendInfo?.TrackSurfaceTemp);

    label = 'TRK';
    value = formatTemp(trackTempC, system);
    unit = tempUnit(system);
    color = '#fbbf24';
  } else if (type === 'wind') {
    const windVelMps =
      env?.wind_vel ?? parseWeekendFloat(weekendInfo?.TrackWindVel);

    label = 'WIND';
    value = formatWindSpeed(windVelMps, system);
    color = getWindColor(windVelMps);
    wide = true;
  } else if (type === 'humidity') {
    const rawHumidity =
      env?.relative_humidity !== undefined && env?.relative_humidity !== null
        ? env.relative_humidity * 100
        : parseWeekendFloat(weekendInfo?.TrackRelativeHumidity);

    label = 'HUM.';
    value = rawHumidity !== null ? `${Math.round(rawHumidity)}%` : '—';
    color = '#fff';
  }

  return (
    <div
      className={`${styles.statCell}${wide ? ` ${styles.statCellWide}` : ''}`}
      style={{ borderLeftColor: color }}
    >
      <span className={styles.statLabel}>{label}</span>

      <span className={styles.statValue}>
        {value}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
    </div>
  );
});
