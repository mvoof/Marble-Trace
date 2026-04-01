import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../store/telemetry.store';
import type { TelemetryFrame } from '../../../types/bindings';
import styles from './ExampleWidget.module.scss';

const fmt = (v: number | null | undefined, decimals = 1): string =>
  v != null ? v.toFixed(decimals) : '—';

const EMPTY_FRAME: TelemetryFrame = {
  speed: 0,
  rpm: 0,
  gear: 0,
  throttle: 0,
  brake: 0,
  steering_wheel_angle: 0,
  fuel_level: 0,
  oil_temp: 0,
  water_temp: 0,
  lap_current_lap_time: 0,
  clutch: null,
  lap: null,
  lap_dist: null,
  lap_dist_pct: null,
  lap_last_lap_time: null,
  lap_best_lap_time: null,
  session_time: null,
  session_time_remain: null,
  session_state: null,
  session_flags: null,
  session_num: null,
  velocity_x: null,
  velocity_y: null,
  velocity_z: null,
  yaw_rate: null,
  pitch: null,
  roll: null,
  lat_accel: null,
  long_accel: null,
  fuel_level_pct: null,
  fuel_use_per_hour: null,
  oil_press: null,
  voltage: null,
  player_car_position: null,
  player_car_class_position: null,
  car_left_right: null,
  on_pit_road: null,
  is_on_track: null,
  air_temp: null,
  shift_indicator_pct: null,
  shift_grind_rpm: null,
};

export const ExampleWidget = observer(() => {
  const { frame, isConnected, error } = telemetryStore;
  const data = frame ?? EMPTY_FRAME;

  const statusLine = !isConnected
    ? //TODO: use antd icon
      error
      ? `⚠ ${error}\n`
      : '⏳ Waiting for iRacing...\n'
    : '';

  return (
    <pre className={styles.widget}>
      {statusLine && (
        <span className={styles.waiting}>
          {statusLine}
          {'\n'}
        </span>
      )}
      <span className={styles.sectionTitle}>{'— Test data —\n'}</span>

      <span className={styles.row}>
        <span className={styles.label}>Speed</span>
        <span className={styles.value}>{fmt(data.speed)} m/s</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Shift Grind RPM</span>
        <span className={styles.value}>{data.shift_grind_rpm} RPM</span>
        {'\n'}
      </span>
    </pre>
  );
});
