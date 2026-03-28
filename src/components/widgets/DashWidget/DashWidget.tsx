import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../store/telemetry.store';
import styles from './DashWidget.module.scss';
import type { TelemetryFrame } from '../../../types/bindings';

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
};

const formatGear = (gear: number): string => {
  if (gear === 0) return 'N';
  if (gear < 0) return 'R';
  return gear.toString();
};

export const DashWidget = observer(() => {
  const { frame } = telemetryStore;
  const data = frame ?? EMPTY_FRAME;

  const speedKmh = Math.round(data.speed * 3.6);
  const rpm = Math.round(data.rpm);
  const gear = formatGear(data.gear);

  return (
    <section className={styles.dash}>
      <article className={styles.topRow}>
        <div className={styles.gearContainer}>
          <span className={styles.gearLabel}>GEAR</span>
          <span className={styles.gearValue}>{gear}</span>
        </div>

        <div className={styles.speedContainer}>
          <span className={styles.speedValue}>{speedKmh}</span>
          <span className={styles.speedUnit}>KM/H</span>
        </div>
      </article>

      <article className={styles.rpmContainer}>
        <div className={styles.rpmLabelRow}>
          <span>RPM</span>
          <span className={styles.rpmValue}>{rpm}</span>
        </div>

        <div className={styles.rpmBarOuter}>
          <div
            className={styles.rpmBarInner}
            style={{ width: `${Math.min(100, (rpm / 10000) * 100)}%` }}
          />
        </div>
      </article>
    </section>
  );
});
