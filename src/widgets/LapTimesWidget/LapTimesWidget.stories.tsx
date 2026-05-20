import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapTimesList } from './LapTimesList/LapTimesList';
import { widgetDecorator } from '@/storybook/widgetDecorator';

const DEFAULT_SETTINGS = {
  showLastLap: true,
  showBestLap: true,
  showP1: true,
  showPredicted: true,
  layout: 'vertical' as const,
};

const meta: Meta<typeof LapTimesList> = {
  title: 'Widgets/LapTimesWidget',
  component: LapTimesList,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ display: 'inline-block', minWidth: 200 })],
  args: {
    currentLapTime: '1:23.456',
    predictedLapTime: '1:22.326',
    lastLapTime: '1:24.102',
    lastDelta: '+0.646',
    lastDeltaColor: '#ef4444',
    bestLapTime: '1:22.891',
    bestDelta: '-0.565',
    bestDeltaColor: '#22c55e',
    p1LapTime: '1:21.543',
    p1Delta: '+1.913',
    p1DeltaColor: '#ef4444',
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof LapTimesList>;

export const DefaultVertical: Story = {};

export const Horizontal: Story = {
  decorators: [widgetDecorator({ width: 1150 })],
  args: {
    settings: { ...DEFAULT_SETTINGS, layout: 'horizontal' },
  },
};

export const CurrentOnly: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showLastLap: false,
      showBestLap: false,
      showP1: false,
    },
  },
};

export const WithDeltas: Story = {
  args: {
    lastDelta: '-0.211',
    lastDeltaColor: '#22c55e',
    bestDelta: '-0.211',
    bestDeltaColor: '#22c55e',
  },
};

export const NoData: Story = {
  args: {
    currentLapTime: '--:--.---',
    predictedLapTime: '--:--.---',
    lastLapTime: '--:--.---',
    lastDelta: '+-.---',
    bestLapTime: '--:--.---',
    bestDelta: '+-.---',
    p1LapTime: '--:--.---',
    p1Delta: '+-.---',
  },
};
