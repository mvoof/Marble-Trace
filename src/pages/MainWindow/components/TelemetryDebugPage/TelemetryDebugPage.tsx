import { observer } from 'mobx-react-lite';
import { Card, Col, Descriptions, Row, Tag, Typography } from 'antd';

import {
  useCarDynamics,
  useCarInputs,
  useCarStatus,
  useEnvironment,
  useLapTiming,
  useSession,
} from '../../../../hooks/useIracingData';

const { Title } = Typography;

const fmt = (v: number | null | undefined, decimals = 2) =>
  v != null ? v.toFixed(decimals) : '—';

export const TelemetryDebugPage = observer(() => {
  const carDynamics = useCarDynamics();
  const carInputs = useCarInputs();
  const carStatus = useCarStatus();
  const lapTiming = useLapTiming();
  const { frame: sessionFrame, driverInfo, weekendInfo } = useSession();
  const environment = useEnvironment();

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      <Title level={3}>Telemetry Debug</Title>

      <Row gutter={[16, 16]}>
        {/* Car Dynamics */}
        <Col span={12}>
          <Card title="Car Dynamics" size="small">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Speed">
                {fmt(carDynamics?.speed)} m/s
              </Descriptions.Item>
              <Descriptions.Item label="RPM">
                {fmt(carDynamics?.rpm, 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Gear">
                {carDynamics?.gear ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Steering">
                {fmt(carDynamics?.steering_wheel_angle)} rad
              </Descriptions.Item>
              <Descriptions.Item label="Lat Accel">
                {fmt(carDynamics?.lat_accel)} m/s²
              </Descriptions.Item>
              <Descriptions.Item label="Long Accel">
                {fmt(carDynamics?.long_accel)} m/s²
              </Descriptions.Item>
              <Descriptions.Item label="Shift Ind. Pct">
                {fmt(carDynamics?.shift_indicator_pct)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Car Inputs */}
        <Col span={12}>
          <Card title="Car Inputs" size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Throttle">
                {fmt(carInputs?.throttle)}
              </Descriptions.Item>
              <Descriptions.Item label="Brake">
                {fmt(carInputs?.brake)}
              </Descriptions.Item>
              <Descriptions.Item label="Clutch">
                {fmt(carInputs?.clutch)} (1=engaged)
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Car Status & Environment */}
        <Col span={12}>
          <Card title="Car Status & Env" size="small">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Fuel Level">
                {fmt(carStatus?.fuel_level)} L
              </Descriptions.Item>
              <Descriptions.Item label="Fuel Use">
                {fmt(carStatus?.fuel_use_per_hour)} kg/h
              </Descriptions.Item>
              <Descriptions.Item label="Water Temp">
                {fmt(carStatus?.water_temp)} °C
              </Descriptions.Item>
              <Descriptions.Item label="Oil Temp">
                {fmt(carStatus?.oil_temp)} °C
              </Descriptions.Item>
              <Descriptions.Item label="Voltage">
                {fmt(carStatus?.voltage)} V
              </Descriptions.Item>
              <Descriptions.Item label="On Pit Road">
                {carStatus?.on_pit_road ? <Tag color="warning">YES</Tag> : 'NO'}
              </Descriptions.Item>
              <Descriptions.Item label="Air Temp">
                {fmt(environment?.air_temp)} °C
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Lap Timing */}
        <Col span={12}>
          <Card title="Lap Timing" size="small">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Lap">
                {lapTiming?.lap ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Dist Pct">
                {fmt((lapTiming?.lap_dist_pct ?? 0) * 100)} %
              </Descriptions.Item>
              <Descriptions.Item label="Current Time">
                {fmt(lapTiming?.lap_current_lap_time)} s
              </Descriptions.Item>
              <Descriptions.Item label="Best Time">
                {fmt(lapTiming?.lap_best_lap_time)} s
              </Descriptions.Item>
              <Descriptions.Item label="Position">
                P {lapTiming?.player_car_position ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Class Pos">
                P {lapTiming?.player_car_class_position ?? '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Session Details */}
        <Col span={24}>
          <Card title="Session & Weekend" size="small">
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="Time Remaining">
                {fmt(sessionFrame?.session_time_remain)} s
              </Descriptions.Item>
              <Descriptions.Item label="Track">
                {weekendInfo?.track_display_name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Redline RPM">
                {fmt(driverInfo?.driver_car_red_line, 0)}
              </Descriptions.Item>
              <Descriptions.Item label="Fuel Max">
                {fmt(driverInfo?.driver_car_fuel_max_ltr)} L
              </Descriptions.Item>
              <Descriptions.Item label="Setup">
                {driverInfo?.driver_setup_name ?? '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
});
