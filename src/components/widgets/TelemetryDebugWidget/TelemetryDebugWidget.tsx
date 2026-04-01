import React from 'react';
import { observer } from 'mobx-react-lite';
import {
  useCarDynamics,
  useCarInputs,
  useCarStatus,
  useEnvironment,
  useLapTiming,
  useSession,
} from '../../../hooks/useIracingData';
import { telemetryConnection } from '../../../store/iracing';
import { WidgetPanel } from '../primitives/WidgetPanel';
import styles from './TelemetryDebugWidget.module.scss';

const fmt = (v: number | null | undefined, decimals = 1): string =>
  v != null ? v.toFixed(decimals) : '—';

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <span className={styles.label}>{label}</span>
    <span className={styles.value}>{value}</span>
  </>
);

export const TelemetryDebugWidget = observer(() => {
  const { status } = telemetryConnection;
  const carDynamics = useCarDynamics();
  const carInputs = useCarInputs();
  const carStatus = useCarStatus();
  const lapTiming = useLapTiming();
  const { frame: sessionFrame, driverInfo, weekendInfo } = useSession();
  const environment = useEnvironment();

  const isConnected = status === 'connected';

  const statusLine = !isConnected
    ? status === 'error'
      ? '⚠ ERROR: Connection lost\n'
      : '⏳ Waiting for iRacing...\n'
    : '';

  return (
    <WidgetPanel className={styles.widget} minWidth={400} direction="column">
      {statusLine && <span className={styles.waiting}>{statusLine}</span>}

      <div className={styles.grid}>
        <span className={styles.sectionTitle}>Dynamics</span>
        <Row label="Speed" value={`${fmt(carDynamics?.speed)} m/s`} />
        <Row label="RPM" value={fmt(carDynamics?.rpm, 0)} />
        <Row label="Gear" value={carDynamics?.gear ?? '—'} />
        <Row
          label="Steering"
          value={`${fmt(carDynamics?.steering_wheel_angle)} rad`}
        />
        <Row label="Lat Acc" value={`${fmt(carDynamics?.lat_accel)} m/s²`} />
        <Row label="Long Acc" value={`${fmt(carDynamics?.long_accel)} m/s²`} />

        <span className={styles.sectionTitle}>Inputs</span>
        <Row label="Throttle" value={fmt(carInputs?.throttle)} />
        <Row label="Brake" value={fmt(carInputs?.brake)} />
        <Row label="Clutch" value={fmt(carInputs?.clutch)} />

        <span className={styles.sectionTitle}>Status & Env</span>
        <Row label="Fuel Level" value={`${fmt(carStatus?.fuel_level)} L`} />
        <Row label="Water Temp" value={`${fmt(carStatus?.water_temp)} °C`} />
        <Row
          label="On Pit Road"
          value={carStatus?.on_pit_road ? 'YES' : 'NO'}
        />
        <Row label="Air Temp" value={`${fmt(environment?.air_temp)} °C`} />

        <span className={styles.sectionTitle}>Timing</span>
        <Row label="Lap" value={lapTiming?.lap ?? '—'} />
        <Row
          label="Last Time"
          value={`${fmt(lapTiming?.lap_last_lap_time)} s`}
        />
        <Row
          label="Best Time"
          value={`${fmt(lapTiming?.lap_best_lap_time)} s`}
        />
        <Row label="Pos" value={`P${lapTiming?.player_car_position ?? '—'}`} />

        <span className={styles.sectionTitle}>Session</span>
        <Row
          label="Remain"
          value={`${fmt(sessionFrame?.session_time_remain)} s`}
        />
        <Row label="Redline" value={fmt(driverInfo?.driver_car_red_line, 0)} />
        <Row
          label="Fuel Max"
          value={`${fmt(driverInfo?.driver_car_fuel_max_ltr)} L`}
        />
        <Row label="Track" value={weekendInfo?.track_name ?? '—'} />
      </div>
    </WidgetPanel>
  );
});
