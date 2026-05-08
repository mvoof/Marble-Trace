import React, { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapDeltaWidget } from './LapDeltaWidget';
import type { DeltaDisplayHandle } from './LapDeltaWidget';

const WithRef = (
  props: Omit<React.ComponentProps<typeof LapDeltaWidget>, 'deltaDisplayRef'>
) => {
  const deltaDisplayRef = useRef<DeltaDisplayHandle | null>(null);
  return <LapDeltaWidget {...props} deltaDisplayRef={deltaDisplayRef} />;
};

const meta: Meta<typeof WithRef> = {
  title: 'Widgets/LapDeltaWidget',
  component: WithRef,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
          display: 'inline-block',
          minWidth: 150,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    initialDeltaFormatted: '-0.342',
    initialDeltaState: 'ahead',
    sectorDeltas: [],
    sectorTimes: [],
    layout: 'vertical',
    showSectorTimes: false,
  },
};

export default meta;
type Story = StoryObj<typeof WithRef>;

export const AheadVertical: Story = {};

export const BehindVertical: Story = {
  args: {
    initialDeltaFormatted: '+0.812',
    initialDeltaState: 'behind',
  },
};

export const Neutral: Story = {
  args: {
    initialDeltaFormatted: '+0.000',
    initialDeltaState: 'neutral',
  },
};

export const Horizontal: Story = {
  args: {
    layout: 'horizontal',
    showSectorTimes: true,
    sectorTimes: [22.1, 31.4, null],
    sectorDeltas: [-0.12, 0.08, null],
  },
};

export const NoSectorTimes: Story = {
  args: {
    showSectorTimes: false,
    sectorTimes: [],
    sectorDeltas: [],
  },
};

export const WithSectorData: Story = {
  args: {
    initialDeltaFormatted: '-0.215',
    initialDeltaState: 'ahead',
    showSectorTimes: true,
    sectorTimes: [22.1, 31.4, 18.7],
    sectorDeltas: [-0.12, 0.08, -0.24],
  },
};
