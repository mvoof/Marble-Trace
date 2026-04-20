import React, { useEffect, useRef } from 'react';
import { toJS } from 'mobx';

import { WidgetPanel } from '../primitives/WidgetPanel';
import type {
  CarDynamicsFrame,
  CarInputsFrame,
  CarStatusFrame,
  LapTimingFrame,
  SessionFrame,
  DriverInfoData,
  WeekendInfo,
  EnvironmentFrame,
} from '../../../types/bindings';

import styles from './TelemetryDebugWidget.module.scss';

const fmt = (v: number | null | undefined, decimals = 1): string =>
  v != null ? v.toFixed(decimals) : '—';

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    <span className={styles.label}>{label}</span>
    <span className={styles.value}>{value}</span>
  </>
);

interface TelemetryDebugWidgetProps {
  status: string;
  carDynamics: CarDynamicsFrame | null;
  carInputs: CarInputsFrame | null;
  carStatus: CarStatusFrame | null;
  lapTiming: LapTimingFrame | null;
  session: SessionFrame | null;
  driverInfo: DriverInfoData | null;
  weekendInfo: WeekendInfo | null;
  environment: EnvironmentFrame | null;
}

export const TelemetryDebugWidget = ({
  status,
  carDynamics,
  carInputs,
  carStatus,
  lapTiming,
  session,
  driverInfo,
  weekendInfo,
  environment,
}: TelemetryDebugWidgetProps) => {
  const hasLoggedRef = useRef(false);

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
          label="Last Time"
          value={`${fmt(lapTiming?.lap_last_lap_time)} s`}
        />
        <Row
          label="Best Time"
          value={`${fmt(lapTiming?.lap_best_lap_time)} s`}
        />
        <Row label="Pos" value={`P${lapTiming?.player_car_position ?? '—'}`} />

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
};
