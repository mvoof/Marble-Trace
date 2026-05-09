import type { Meta, StoryObj } from '@storybook/react-vite';

import { SpeedWidget } from './SpeedWidget';

const DESIGN_WIDTH = 312;
const DESIGN_HEIGHT = 90;

const DEFAULT_SETTINGS = {
  focusMode: 'speed' as const,
  rpmColorTheme: 'custom' as const,
  rpmColorLow: '#22c55e',
  rpmColorMid: '#eab308',
  rpmColorHigh: '#ef4444',
  rpmColorLimit: '#ff4d00',
  showPitPanel: true,
  showRpmBar: true,
  showTemps: false,
  pitSpeedLimitOverride: null,
};

const BG = 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)';

const meta: Meta<typeof SpeedWidget> = {
  title: 'Widgets/SpeedWidget',
  component: SpeedWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          background: BG,
          overflow: 'visible',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    initialSpeed: '120',
    speedUnit: 'km/h',
    initialRpm: 5400,
    initialGear: 3,
    maxShiftRpm: 8000,
    settings: DEFAULT_SETTINGS,
    isOnPitRoad: false,
    pitLimiterActive: false,
    initialPitState: 'pit-lane',
    pitLimitFormatted: '60',
    initialPitSpeedDelta: null,
    oilTemp: '92',
    waterTemp: '88',
    tempUnit: '°C',
    oilTempWarn: false,
    waterTempWarn: false,
  },
};

export default meta;
type Story = StoryObj<typeof SpeedWidget>;

export const Default: Story = {};

export const GearFocus: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, focusMode: 'gear' },
  },
};

export const HighRpm: Story = {
  args: {
    initialSpeed: '223',
    initialRpm: 7800,
    initialGear: 5,
  },
};

export const OnPitRoad: Story = {
  args: {
    isOnPitRoad: true,
    initialPitState: 'pit-lane',
    pitLimitFormatted: '60',
    initialPitSpeedDelta: null,
    initialSpeed: '45',
    initialRpm: 2800,
    initialGear: 2,
  },
};

export const PitLimiterActive: Story = {
  args: {
    isOnPitRoad: true,
    pitLimiterActive: true,
    initialPitState: 'limiter-active',
    pitLimitFormatted: '60',
    initialPitSpeedDelta: 0,
    initialSpeed: '60',
    initialRpm: 3100,
    initialGear: 3,
  },
};

export const OverPitLimit: Story = {
  args: {
    isOnPitRoad: true,
    pitLimiterActive: true,
    initialPitState: 'over-limit',
    pitLimitFormatted: '60',
    initialPitSpeedDelta: 5,
    initialSpeed: '65',
    initialRpm: 3400,
    initialGear: 3,
  },
};

export const WithTemps: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showTemps: true },
    oilTemp: '92',
    waterTemp: '88',
    tempUnit: '°C',
    oilTempWarn: false,
    waterTempWarn: false,
  },
};

export const TempWarning: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showTemps: true },
    oilTemp: '115',
    waterTemp: '108',
    tempUnit: '°C',
    oilTempWarn: true,
    waterTempWarn: true,
  },
};

export const NoRpmBar: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showRpmBar: false },
  },
};
