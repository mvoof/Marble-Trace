import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapDeltaWidget } from './LapDeltaWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 160;

const wrap = (props: ComponentProps<typeof LapDeltaWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <LapDeltaWidget {...props} />
    </WidgetScaler>
  </div>
);

const meta: Meta<typeof LapDeltaWidget> = {
  title: 'Widgets/LapDeltaWidget',
  component: LapDeltaWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof LapDeltaWidget>;

export const Default: Story = {
  args: {
    deltaFormatted: '+1.234',
    deltaState: 'behind',
    currentLap: 12,
    totalLaps: '38',
    sectorDeltas: [null, null, null],
  },
};

export const Ahead: Story = {
  args: {
    deltaFormatted: '-0.456',
    deltaState: 'ahead',
    currentLap: 8,
    totalLaps: '38',
    sectorDeltas: [null, null, null],
  },
};

export const WithSectors: Story = {
  args: {
    deltaFormatted: '+0.312',
    deltaState: 'behind',
    currentLap: 5,
    totalLaps: '30',
    sectorDeltas: [0.1, -0.05, 0.26],
  },
};

export const TwoSectors: Story = {
  args: {
    deltaFormatted: '-0.180',
    deltaState: 'ahead',
    currentLap: 7,
    totalLaps: '20',
    sectorDeltas: [-0.12, -0.06],
  },
};

export const FiveSectors: Story = {
  args: {
    deltaFormatted: '+0.540',
    deltaState: 'behind',
    currentLap: 3,
    totalLaps: '15',
    sectorDeltas: [0.05, -0.03, 0.18, 0.22, 0.1],
  },
};

export const NearZero: Story = {
  args: {
    deltaFormatted: '+0.023',
    deltaState: 'neutral',
    currentLap: 1,
    totalLaps: '38',
    sectorDeltas: [null, null, null],
  },
};

export const Unlimited: Story = {
  args: {
    deltaFormatted: '-0.780',
    deltaState: 'ahead',
    currentLap: 3,
    totalLaps: 'unlimited',
    sectorDeltas: [null, null, null],
  },
};

export const NoData: Story = {
  args: {
    deltaFormatted: '—',
    deltaState: 'neutral',
    currentLap: null,
    totalLaps: null,
    sectorDeltas: [],
  },
};
