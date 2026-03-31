import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../store/telemetry.store';
import styles from './ExampleWidget.module.scss';
import type { TelemetryFrame } from '../../../types/bindings';

const fmt = (v: number | null | undefined, decimals = 1): string =>
  v != null ? v.toFixed(decimals) : '—';

const fmtPct = (v: number | null | undefined): string =>
  v != null ? `${(v * 100).toFixed(0)}%` : '—';

const fmtBool = (v: boolean | null | undefined): string =>
  v != null ? (v ? 'Yes' : 'No') : '—';

const fmtTime = (v: number | null | undefined): string => {
  if (v == null || v < 0) return '—';
  const mins = Math.floor(v / 60);
  const secs = v % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
};

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
  driver_car_sl_first_rpm: null,
  driver_car_sl_shift_rpm: null,
  driver_car_sl_last_rpm: null,
  driver_car_sl_blink_rpm: null,
  driver_car_red_line: null,
  driver_car_idle_rpm: null,
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
      <span className={styles.sectionTitle}>{'— Driver —\n'}</span>

      <span className={styles.row}>
        <span className={styles.label}>Speed</span>
        <span className={styles.value}>{fmt(data.speed)} m/s</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>RPM</span>
        <span className={styles.value}>{fmt(data.rpm, 0)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Gear</span>
        <span className={styles.value}>{data.gear}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Throttle</span>
        <span className={styles.value}>{fmtPct(data.throttle)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Brake</span>
        <span className={styles.value}>{fmtPct(data.brake)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Clutch</span>
        <span className={styles.value}>{fmtPct(data.clutch)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Steering</span>
        <span className={styles.value}>
          {fmt(data.steering_wheel_angle, 2)} rad
        </span>
        {'\n'}
      </span>

      <span className={styles.sectionTitle}>{'\n— Laps —\n'}</span>

      <span className={styles.row}>
        <span className={styles.label}>Lap</span>
        <span className={styles.value}>{data.lap ?? '—'}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Lap Time</span>
        <span className={styles.value}>
          {fmtTime(data.lap_current_lap_time)}
        </span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Last Lap</span>
        <span className={styles.value}>{fmtTime(data.lap_last_lap_time)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Best Lap</span>
        <span className={styles.value}>{fmtTime(data.lap_best_lap_time)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Lap Dist%</span>
        <span className={styles.value}>{fmtPct(data.lap_dist_pct)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Lap Dist</span>
        <span className={styles.value}>{fmt(data.lap_dist, 0)} m</span>
        {'\n'}
      </span>

      <span className={styles.sectionTitle}>{'\n— Dynamics —\n'}</span>

      <span className={styles.row}>
        <span className={styles.label}>Velocity X</span>
        <span className={styles.value}>{fmt(data.velocity_x, 2)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Velocity Y</span>
        <span className={styles.value}>{fmt(data.velocity_y, 2)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Velocity Z</span>
        <span className={styles.value}>{fmt(data.velocity_z, 2)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Yaw Rate</span>
        <span className={styles.value}>{fmt(data.yaw_rate, 3)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Pitch</span>
        <span className={styles.value}>{fmt(data.pitch, 3)}</span>
        {'\n'}
      </span>
      <span className={styles.row}>
        <span className={styles.label}>Roll</span>
        <span className={styles.value}>{fmt(data.roll, 3)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Lat Accel</span>
        <span className={styles.value}>{fmt(data.lat_accel, 2)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Long Accel</span>
        <span className={styles.value}>{fmt(data.long_accel, 2)}</span>
        {'\n'}
      </span>
      <span className={styles.sectionTitle}>{'\n— Engine —\n'}</span>
      <span className={styles.row}>
        <span className={styles.label}>Fuel</span>
        <span className={styles.value}>{fmt(data.fuel_level, 2)} L</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Fuel%</span>
        <span className={styles.value}>{fmtPct(data.fuel_level_pct)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Fuel Use/h</span>
        <span className={styles.value}>
          {fmt(data.fuel_use_per_hour, 2)} L/h
        </span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Oil Temp</span>
        <span className={styles.value}>{fmt(data.oil_temp)}°C</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Oil Press</span>
        <span className={styles.value}>{fmt(data.oil_press, 1)} bar</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Water Temp</span>
        <span className={styles.value}>{fmt(data.water_temp)}°C</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Voltage</span>
        <span className={styles.value}>{fmt(data.voltage, 1)} V</span>
        {'\n'}
      </span>

      <span className={styles.sectionTitle}>{'\n— Session —\n'}</span>
      <span className={styles.row}>
        <span className={styles.label}>Position</span>
        <span className={styles.value}>{data.player_car_position ?? '—'}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Class Pos</span>
        <span className={styles.value}>
          {data.player_car_class_position ?? '—'}
        </span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Session #</span>
        <span className={styles.value}>{data.session_num ?? '—'}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>State</span>
        <span className={styles.value}>{data.session_state ?? '—'}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Flags</span>
        <span className={styles.value}>{data.session_flags ?? '—'}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>On Pit</span>
        <span className={styles.value}>{fmtBool(data.on_pit_road)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>On Track</span>
        <span className={styles.value}>{fmtBool(data.is_on_track)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Car L/R</span>
        <span className={styles.value}>{data.car_left_right ?? '—'}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Sess Time</span>
        <span className={styles.value}>{fmtTime(data.session_time)}</span>
        {'\n'}
      </span>

      <span className={styles.row}>
        <span className={styles.label}>Remaining</span>
        <span className={styles.value}>
          {fmtTime(data.session_time_remain)}
        </span>
        {'\n'}
      </span>

      <span className={styles.sectionTitle}>{'\n— Test variable —\n'}</span>
      <span className={styles.row}>
        <span className={styles.label}>Air temp</span>
        <span className={styles.value}>{data.air_temp} °C</span>
        {'\n'}
      </span>
    </pre>
  );
});
