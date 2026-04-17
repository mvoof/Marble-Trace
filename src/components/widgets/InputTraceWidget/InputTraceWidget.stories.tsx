import type { Meta, StoryObj } from '@storybook/react-vite';

import { InputTraceWidget } from './InputTraceWidget';
import { WidgetScaler } from '../../WidgetScaler';
import type { InputTraceSettings } from '../../../store/widget-settings.store';
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
  containerWidth: number;
  containerHeight: number;
}

const InputTraceWidgetStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
  ...settings
}: InputTraceStoryArgs) => {
  const frame = snap.carInputs;
  const throttle = frame?.throttle ?? 0;
  const brake = frame?.brake ?? 0;
  const clutch = frame?.clutch != null ? 1 - frame.clutch : 0;

  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
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
  argTypes: {
    containerWidth: {
      control: { type: 'range', min: 100, max: 1000, step: 10 },
      description: 'Container width (px)',
      table: { category: 'Container' },
    },
    containerHeight: {
      control: { type: 'range', min: 50, max: 600, step: 10 },
      description: 'Container height (px)',
      table: { category: 'Container' },
    },
    barMode: {
      control: 'radio',
      options: ['horizontal', 'vertical', 'hidden'],
      description: 'Progress bar orientation',
      table: { category: 'Widget Settings' },
    },
    showThrottle: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showBrake: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showClutch: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    throttleColor: {
      control: 'color',
      table: { category: 'Widget Settings' },
    },
    brakeColor: {
      control: 'color',
      table: { category: 'Widget Settings' },
    },
    clutchColor: {
      control: 'color',
      table: { category: 'Widget Settings' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    containerWidth: DESIGN_WIDTH,
    containerHeight: DESIGN_HEIGHT,
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<InputTraceStoryArgs>;

export const Default: Story = {};

export const Vertical: Story = {
  args: {
    barMode: 'vertical',
    containerWidth: 400,
    containerHeight: 110,
  },
};

export const NoBars: Story = {
  args: {
    barMode: 'hidden',
  },
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
