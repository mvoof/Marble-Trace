import type { Meta, StoryObj } from '@storybook/react-vite';

import { TelemetryDebugWidget } from './TelemetryDebugWidget';
import { WidgetScaler } from '../../WidgetScaler';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 400;
const DESIGN_HEIGHT = 700;

const realSnapshot = snapshot as TelemetrySnapshot;

interface TelemetryDebugStoryArgs {
  snapshot: TelemetrySnapshot;
  containerWidth: number;
  containerHeight: number;
}

const TelemetryDebugWidgetStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
}: TelemetryDebugStoryArgs) => (
  <div style={{ width: containerWidth, height: containerHeight }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <TelemetryDebugWidget
        status="connected"
        carDynamics={snap.carDynamics}
        carInputs={snap.carInputs}
        carStatus={snap.carStatus}
        lapTiming={snap.lapTiming}
        session={snap.session}
        driverInfo={snap.sessionInfo?.DriverInfo ?? null}
        weekendInfo={snap.sessionInfo?.WeekendInfo ?? null}
        environment={snap.environment}
      />
    </WidgetScaler>
  </div>
);

const meta: Meta<TelemetryDebugStoryArgs> = {
  title: 'Widgets/TelemetryDebugWidget',
  component: TelemetryDebugWidgetStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    containerWidth: {
      control: { type: 'range', min: 200, max: 800, step: 10 },
      description: 'Container width (px)',
      table: { category: 'Container' },
    },
    containerHeight: {
      control: { type: 'range', min: 200, max: 1200, step: 10 },
      description: 'Container height (px)',
      table: { category: 'Container' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    containerWidth: DESIGN_WIDTH,
    containerHeight: DESIGN_HEIGHT,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<TelemetryDebugStoryArgs>;

export const Default: Story = {};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carDynamics: null,
      carIdx: null,
      carInputs: null,
      carStatus: null,
      environment: null,
      lapTiming: null,
      session: null,
      sessionInfo: null,
    },
  },
};
