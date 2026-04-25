import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapTimesWidget } from './LapTimesWidget';
import { WidgetScaler } from '../../WidgetScaler';

const VERTICAL_WIDTH = 260;
const VERTICAL_HEIGHT = 160;
const HORIZONTAL_WIDTH = 480;
const HORIZONTAL_HEIGHT = 80;

const wrap = (props: ComponentProps<typeof LapTimesWidget>) => {
  const isHorizontal = props.settings.layout === 'horizontal';
  const w = isHorizontal ? HORIZONTAL_WIDTH : VERTICAL_WIDTH;
  const h = isHorizontal ? HORIZONTAL_HEIGHT : VERTICAL_HEIGHT;
  return (
    <div style={{ width: w, height: h }}>
      <WidgetScaler
        designWidth={w}
        designHeight={h}
        background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
      >
        <LapTimesWidget {...props} />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<typeof LapTimesWidget> = {
  title: 'Widgets/LapTimesWidget',
  component: LapTimesWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof LapTimesWidget>;

export const VerticalDefault: Story = {
  args: {
    currentLapTime: '1:49.123',
    lastLapTime: '1:49.010',
    lastLapDelta: '+0.277',
    bestLapTime: '1:48.733',
    p1LapTime: '1:48.401',
    p1Delta: '-0.332',
    settings: {
      showLastLap: true,
      showBestLap: true,
      showP1: true,
      layout: 'vertical',
    },
  },
};

export const HorizontalDefault: Story = {
  args: {
    currentLapTime: '1:49.123',
    lastLapTime: '1:49.010',
    lastLapDelta: '+0.277',
    bestLapTime: '1:48.733',
    p1LapTime: '1:48.401',
    p1Delta: '-0.332',
    settings: {
      showLastLap: true,
      showBestLap: true,
      showP1: true,
      layout: 'horizontal',
    },
  },
};

export const FirstLap: Story = {
  args: {
    currentLapTime: '1:12.345',
    lastLapTime: '—',
    lastLapDelta: '—',
    bestLapTime: '—',
    p1LapTime: '1:49.204',
    p1Delta: '—',
    settings: {
      showLastLap: true,
      showBestLap: true,
      showP1: true,
      layout: 'vertical',
    },
  },
};

export const NoData: Story = {
  args: {
    currentLapTime: '0:00.000',
    lastLapTime: '—',
    lastLapDelta: '—',
    bestLapTime: '—',
    p1LapTime: '—',
    p1Delta: '—',
    settings: {
      showLastLap: true,
      showBestLap: true,
      showP1: true,
      layout: 'vertical',
    },
  },
};
