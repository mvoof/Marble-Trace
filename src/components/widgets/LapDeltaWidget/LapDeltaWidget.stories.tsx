import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapDeltaWidget } from './LapDeltaWidget';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 160;

const wrap = (props: ComponentProps<typeof LapDeltaWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
        overflow: 'hidden',
      }}
    >
      <LapDeltaWidget {...props} />
    </div>
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
    sectorDeltas: [null, null, null],
    sectorTimes: [null, null, null],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const Ahead: Story = {
  args: {
    deltaFormatted: '-0.456',
    deltaState: 'ahead',
    sectorDeltas: [null, null, null],
    sectorTimes: [null, null, null],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const WithSectors: Story = {
  args: {
    deltaFormatted: '+0.312',
    deltaState: 'behind',
    sectorDeltas: [0.1, -0.05, 0.26],
    sectorTimes: [28.4, 31.2, 22.8],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const WithSectorsHorizontal: Story = {
  args: {
    deltaFormatted: '+0.312',
    deltaState: 'behind',
    sectorDeltas: [0.1, -0.05, 0.26],
    sectorTimes: [28.4, 31.2, 22.8],
    layout: 'horizontal',
    showSectorTimes: true,
  },
};

export const SectorTimesHidden: Story = {
  args: {
    deltaFormatted: '+0.312',
    deltaState: 'behind',
    sectorDeltas: [0.1, -0.05, 0.26],
    sectorTimes: [28.4, 31.2, 22.8],
    layout: 'vertical',
    showSectorTimes: false,
  },
};

export const TwoSectors: Story = {
  args: {
    deltaFormatted: '-0.180',
    deltaState: 'ahead',
    sectorDeltas: [-0.12, -0.06],
    sectorTimes: [30.1, 28.7],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const NearZero: Story = {
  args: {
    deltaFormatted: '+0.023',
    deltaState: 'neutral',
    sectorDeltas: [null, null, null],
    sectorTimes: [null, null, null],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const NoData: Story = {
  args: {
    deltaFormatted: '—',
    deltaState: 'neutral',
    sectorDeltas: [],
    sectorTimes: [],
    layout: 'vertical',
    showSectorTimes: true,
  },
};
