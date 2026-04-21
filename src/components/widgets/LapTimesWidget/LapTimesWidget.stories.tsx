import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapTimesWidget } from './LapTimesWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 260;
const DESIGN_HEIGHT = 160;

const wrap = (props: ComponentProps<typeof LapTimesWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <LapTimesWidget {...props} />
    </WidgetScaler>
  </div>
);

const meta: Meta<typeof LapTimesWidget> = {
  title: 'Widgets/LapTimesWidget',
  component: LapTimesWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof LapTimesWidget>;

export const Default: Story = {
  args: {
    lastLapTime: '1:49.010',
    lastLapDelta: '+0.277',
    bestLapTime: '1:48.733',
    p1LapTime: '1:48.401',
    p1Delta: '-0.332',
  },
};

export const IsP1: Story = {
  args: {
    lastLapTime: '1:48.733',
    lastLapDelta: '—',
    bestLapTime: '1:48.733',
    p1LapTime: '1:48.733',
    p1Delta: '—',
  },
};

export const FirstLap: Story = {
  args: {
    lastLapTime: '—',
    lastLapDelta: '—',
    bestLapTime: '—',
    p1LapTime: '1:49.204',
    p1Delta: '—',
  },
};

export const NoData: Story = {
  args: {
    lastLapTime: '—',
    lastLapDelta: '—',
    bestLapTime: '—',
    p1LapTime: '—',
    p1Delta: '—',
  },
};
