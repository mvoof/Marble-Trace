import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpeedWidget } from './SpeedWidget';
import { withTelemetry } from '../../../storybook/telemetryDecorator';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';

/**
 * To use real data: capture a snapshot in Settings → Dev Tools → Capture Snapshot,
 * place the JSON in test-data/, then import it here.
 *
 * import snapshot from '../../../../test-data/my-session.json';
 * export const Real: Story = { decorators: [withTelemetry(snapshot)] };
 */
const mockSnapshot: TelemetrySnapshot = {
  capturedAt: new Date().toISOString(),
  carDynamics: {
    speed: 55.5,
    rpm: 6800,
    gear: 4,
    shift_indicator_pct: 0.85,
    steering_wheel_angle: 0.12,
    lat_accel: 0.3,
    long_accel: -0.1,
    yaw: null,
    yaw_rate: 0.05,
    pitch: null,
    roll: null,
    shift_grind_rpm: null,
    velocity_x: 0.5,
    velocity_y: 55.5,
    velocity_z: null,
  },
  carIdx: null,
  carInputs: null,
  carStatus: null,
  environment: null,
  lapTiming: null,
  session: null,
  sessionInfo: null,
};

const meta: Meta<typeof SpeedWidget> = {
  title: 'Widgets/SpeedWidget',
  component: SpeedWidget,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof SpeedWidget>;

export const Default: Story = {
  decorators: [withTelemetry(mockSnapshot)],
};

export const Redline: Story = {
  decorators: [
    withTelemetry({
      ...mockSnapshot,
      carDynamics: {
        ...mockSnapshot.carDynamics!,
        rpm: 7400,
        shift_indicator_pct: 1.0,
        gear: 3,
      },
    }),
  ],
};

export const NoData: Story = {};
