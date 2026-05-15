import type { Meta, StoryObj } from '@storybook/react-vite';

import { InputTraceWidget } from './InputTraceWidget';
import { widgetDecorator } from '../../../stories/widgetDecorator';

const DESIGN_WIDTH = 500;
const DESIGN_HEIGHT = 120;

const DEFAULT_SETTINGS = {
  showThrottle: true,
  showBrake: true,
  showClutch: true,
  throttleColor: '#22c55e',
  brakeColor: '#ef4444',
  clutchColor: '#60a5fa',
  barMode: 'horizontal' as const,
};

const meta: Meta<typeof InputTraceWidget> = {
  title: 'Widgets/InputTraceWidget',
  component: InputTraceWidget,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT })],
  args: {
    throttle: 0.6,
    brake: 0,
    clutch: 0,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof InputTraceWidget>;

export const Default: Story = {};

export const VerticalBars: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, barMode: 'vertical' },
  },
};

export const HiddenBars: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, barMode: 'hidden' },
  },
};

export const FullThrottle: Story = {
  args: {
    throttle: 1.0,
    brake: 0,
    clutch: 0,
  },
};

export const HeavyBraking: Story = {
  args: {
    throttle: 0,
    brake: 0.95,
    clutch: 0,
  },
};

export const TrailBraking: Story = {
  args: {
    throttle: 0.3,
    brake: 0.5,
    clutch: 0,
  },
};

export const OnlyThrottleBrake: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showClutch: false },
    throttle: 0.7,
    brake: 0,
    clutch: 0,
  },
};
