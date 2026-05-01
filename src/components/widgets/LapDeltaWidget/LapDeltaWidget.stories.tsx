import { useRef, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapDeltaWidget, type DeltaDisplayHandle } from './LapDeltaWidget';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 160;

const wrap = (
  props: Omit<ComponentProps<typeof LapDeltaWidget>, 'deltaDisplayRef'>
) => {
  const deltaDisplayRef = useRef<DeltaDisplayHandle | null>(null);
  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <LapDeltaWidget {...props} deltaDisplayRef={deltaDisplayRef} />
      </div>
    </div>
  );
};

type StoryArgs = Omit<ComponentProps<typeof LapDeltaWidget>, 'deltaDisplayRef'>;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/LapDeltaWidget',
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  args: {
    initialDeltaFormatted: '+1.234',
    initialDeltaState: 'behind',
    sectorDeltas: [null, null, null],
    sectorTimes: [null, null, null],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const Ahead: Story = {
  args: {
    initialDeltaFormatted: '-0.456',
    initialDeltaState: 'ahead',
    sectorDeltas: [null, null, null],
    sectorTimes: [null, null, null],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const WithSectors: Story = {
  args: {
    initialDeltaFormatted: '+0.312',
    initialDeltaState: 'behind',
    sectorDeltas: [0.1, -0.05, 0.26],
    sectorTimes: [28.4, 31.2, 22.8],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const WithSectorsHorizontal: Story = {
  args: {
    initialDeltaFormatted: '+0.312',
    initialDeltaState: 'behind',
    sectorDeltas: [0.1, -0.05, 0.26],
    sectorTimes: [28.4, 31.2, 22.8],
    layout: 'horizontal',
    showSectorTimes: true,
  },
};

export const SectorTimesHidden: Story = {
  args: {
    initialDeltaFormatted: '+0.312',
    initialDeltaState: 'behind',
    sectorDeltas: [0.1, -0.05, 0.26],
    sectorTimes: [28.4, 31.2, 22.8],
    layout: 'vertical',
    showSectorTimes: false,
  },
};

export const TwoSectors: Story = {
  args: {
    initialDeltaFormatted: '-0.180',
    initialDeltaState: 'ahead',
    sectorDeltas: [-0.12, -0.06],
    sectorTimes: [30.1, 28.7],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const NearZero: Story = {
  args: {
    initialDeltaFormatted: '+0.023',
    initialDeltaState: 'neutral',
    sectorDeltas: [null, null, null],
    sectorTimes: [null, null, null],
    layout: 'vertical',
    showSectorTimes: true,
  },
};

export const NoData: Story = {
  args: {
    initialDeltaFormatted: '—',
    initialDeltaState: 'neutral',
    sectorDeltas: [],
    sectorTimes: [],
    layout: 'vertical',
    showSectorTimes: true,
  },
};
