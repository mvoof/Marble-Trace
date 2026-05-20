import type { Meta, StoryObj } from '@storybook/react-vite';

import { TelemetryDebugWidget } from './TelemetryDebugWidget';
import { snapshot } from '../../storybook/test-data';
import { widgetDecorator } from '../../storybook/widgetDecorator';

const CONNECTED_ARGS = {
  status: 'connected',
  carDynamics: snapshot.carDynamics,
  carInputs: snapshot.carInputs,
  carStatus: snapshot.carStatus,
  lapTiming: snapshot.lapTiming,
  session: snapshot.session,
  driverInfo: snapshot.sessionInfo?.DriverInfo ?? null,
  weekendInfo: snapshot.sessionInfo?.WeekendInfo ?? null,
  environment: snapshot.environment,
};

const meta: Meta<typeof TelemetryDebugWidget> = {
  title: 'Widgets/TelemetryDebugWidget',
  component: TelemetryDebugWidget,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 420 })],
  args: CONNECTED_ARGS,
};

export default meta;
type Story = StoryObj<typeof TelemetryDebugWidget>;

export const Connected: Story = {};

export const Disconnected: Story = {
  args: {
    status: 'disconnected',
    carDynamics: null,
    carInputs: null,
    carStatus: null,
    lapTiming: null,
    session: null,
    driverInfo: null,
    weekendInfo: null,
    environment: null,
  },
};

export const Error: Story = {
  args: {
    status: 'error',
    carDynamics: null,
    carInputs: null,
    carStatus: null,
    lapTiming: null,
    session: null,
    driverInfo: null,
    weekendInfo: null,
    environment: null,
  },
};
