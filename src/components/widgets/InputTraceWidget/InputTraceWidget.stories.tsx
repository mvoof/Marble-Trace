import type { Meta, StoryObj } from '@storybook/react-vite';

import { InputTraceWidget } from './InputTraceWidget';
import { WidgetScaler } from '../../WidgetScaler';
import type { InputTraceSettings } from '../../../types/widget-settings';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 400;
const DESIGN_HEIGHT = 220;

const realSnapshot = snapshot as TelemetrySnapshot;

const DEFAULT_SETTINGS: InputTraceSettings = {
  barMode: 'horizontal',
  showThrottle: true,
  showBrake: true,
  showClutch: true,
  throttleColor: '#00ff00',
  brakeColor: '#ff3333',
  clutchColor: '#3399ff',
};

interface InputTraceStoryArgs extends InputTraceSettings {
  snapshot: TelemetrySnapshot;
}

const InputTraceWidgetStory = ({
  snapshot: snap,
  ...settings
}: InputTraceStoryArgs) => {
  const frame = snap.carInputs;
  const throttle = frame?.throttle ?? 0;
  const brake = frame?.brake ?? 0;
  const clutch = frame?.clutch != null ? 1 - frame.clutch : 0;

  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
      >
        <InputTraceWidget
          throttle={throttle}
          brake={brake}
          clutch={clutch}
          settings={settings}
        />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<InputTraceStoryArgs> = {
  title: 'Widgets/InputTraceWidget',
  component: InputTraceWidgetStory,
  parameters: {
    layout: 'centered',
  },
  args: {
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<InputTraceStoryArgs>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { barMode: 'vertical' },
};

export const NoBars: Story = {
  args: { barMode: 'hidden' },
};

export const ThrottleOnly: Story = {
  args: { showBrake: false, showClutch: false },
};

export const BrakeOnly: Story = {
  args: { showThrottle: false, showClutch: false },
};

export const ClutchOnly: Story = {
  args: { showThrottle: false, showBrake: false },
};

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
