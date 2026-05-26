import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';

import styles from './TelemetryDebugWidget.module.scss';
import {
  useTelemetryConnectionStore,
  useTelemetryStore,
} from '@store/root-store-context';

const fmt = (v: number | null | undefined, decimals = 1): string =>
  v != null ? v.toFixed(decimals) : '—';

const Row = observer(
  ({ label, value }: { label: string; value: React.ReactNode }) => (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </>
  )
);

export const TelemetryDebugWidget = observer(() => {
  const telemetryConnection = useTelemetryConnectionStore();
  const telemetry = useTelemetryStore();

  const hasLoggedRef = useRef(false);

  const {
    carDynamics,
    carInputs,
    carStatus,
    lapTiming,
    session,
    driverInfo,
    weekendInfo,
    environment,
  } = telemetry;
  const status = telemetryConnection.status;

  useEffect(() => {
    if (driverInfo && !hasLoggedRef.current) {
      console.log('DRIVER INFO (ONCE):', toJS(driverInfo));
      hasLoggedRef.current = true;
    }
  }, [driverInfo]);

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
          label="Cur Time"
          value={`${fmt(lapTiming?.lap_current_lap_time, 3)} s`}
        />
        <Row
          label="Last Time"
          value={`${fmt(lapTiming?.lap_last_lap_time)} s`}
        />
        <Row
          label="Best Time"
          value={`${fmt(lapTiming?.lap_best_lap_time)} s`}
        />
        <Row label="Pos" value={`P${lapTiming?.player_car_position ?? '—'}`} />
        <Row
          label="SB_Live Δ"
          value={`${fmt(lapTiming?.lap_delta_to_session_best_live, 3)} ok=${lapTiming?.lap_delta_to_session_best_live != null ? '✓' : '—'}`}
        />
        <Row
          label="Opt_Live Δ"
          value={`${fmt(lapTiming?.lap_delta_to_session_optimal_live, 3)}`}
        />
        <Row
          label="DriverBest_Live Δ"
          value={`${fmt(lapTiming?.lap_delta_to_driver_best_live, 3)}`}
        />
        <Row
          label="BestLap Δ"
          value={`${fmt(lapTiming?.lap_delta_to_best_lap, 3)} dd=${lapTiming?.lap_delta_to_best_lap_dd ?? '—'} ok=${lapTiming?.lap_delta_to_best_lap_ok ?? '—'}`}
        />
        <Row
          label="OptLap Δ"
          value={`${fmt(lapTiming?.lap_delta_to_optimal_lap, 3)} dd=${lapTiming?.lap_delta_to_optimal_lap_dd ?? '—'} ok=${lapTiming?.lap_delta_to_optimal_lap_ok ?? '—'}`}
        />
        <Row
          label="SessBestLap Δ"
          value={`${fmt(lapTiming?.lap_delta_to_session_best_lap, 3)} dd=${lapTiming?.lap_delta_to_session_best_lap_dd ?? '—'} ok=${lapTiming?.lap_delta_to_session_best_lap_ok ?? '—'}`}
        />
        <Row
          label="SessLastlLap Δ"
          value={`${fmt(lapTiming?.lap_delta_to_session_lastl_lap, 3)} dd=${lapTiming?.lap_delta_to_session_lastl_lap_dd ?? '—'} ok=${lapTiming?.lap_delta_to_session_lastl_lap_ok ?? '—'}`}
        />
        <Row
          label="SessOptLap Δ"
          value={`${fmt(lapTiming?.lap_delta_to_session_optimal_lap, 3)} dd=${lapTiming?.lap_delta_to_session_optimal_lap_dd ?? '—'} ok=${lapTiming?.lap_delta_to_session_optimal_lap_ok ?? '—'}`}
        />

        <span className={styles.sectionTitle}>Session</span>
        <Row label="Remain" value={`${fmt(session?.session_time_remain)} s`} />
        <Row label="Redline" value={fmt(driverInfo?.DriverCarRedLine, 0)} />
        <Row
          label="Fuel Max"
          value={`${fmt(driverInfo?.DriverCarFuelMaxLtr)} L`}
        />
        <Row label="Track" value={weekendInfo?.TrackName ?? '—'} />
      </div>
    </WidgetPanel>
  );
});
