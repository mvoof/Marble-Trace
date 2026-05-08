import type { Meta, StoryObj } from '@storybook/react-vite';

import { LinearMapWidget } from './LinearMapWidget';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshotRaw from '../../../../test-data/iracing-1776008424511.json';

const snapshot = snapshotRaw as unknown as TelemetrySnapshot;
const DRIVER_ENTRIES = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo?.DriverInfo ?? null
);

const DEFAULT_SETTINGS = {
  orientation: 'horizontal' as const,
  playerDotColor: '#22c55e',
  targetDotRadiusPx: 6,
};

const meta: Meta<typeof LinearMapWidget> = {
  title: 'Widgets/LinearMapWidget',
  component: LinearMapWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 400,
          height: 40,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    entries: DRIVER_ENTRIES,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof LinearMapWidget>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  decorators: [
    (Story) => (
      <div
        style={{
          width: 40,
          height: 300,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    settings: { ...DEFAULT_SETTINGS, orientation: 'vertical' },
  },
};

export const CustomDotColor: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      playerDotColor: '#f59e0b',
      targetDotRadiusPx: 8,
    },
  },
};
