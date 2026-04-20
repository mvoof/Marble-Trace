import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapTimesWidget } from './LapTimesWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 300;
const DESIGN_HEIGHT = 120;

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
    currentLapTime: '1:34.891',
    lastLapTime: '1:35.204',
    bestLapTime: '1:33.756',
    hasBestLap: true,
  },
};

export const FirstLap: Story = {
  args: {
    currentLapTime: '0:42.123',
    lastLapTime: '—',
    bestLapTime: '—',
    hasBestLap: false,
  },
};

export const BestHighlighted: Story = {
  args: {
    currentLapTime: '1:35.102',
    lastLapTime: '1:33.756',
    bestLapTime: '1:33.756',
    hasBestLap: true,
  },
};

export const NoData: Story = {
  args: {
    currentLapTime: '—',
    lastLapTime: '—',
    bestLapTime: '—',
    hasBestLap: false,
  },
};
