import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimerWidget } from './TimerWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 280;
const DESIGN_HEIGHT = 80;

const wrap = (props: ComponentProps<typeof TimerWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <TimerWidget {...props} />
    </WidgetScaler>
  </div>
);

const meta: Meta<typeof TimerWidget> = {
  title: 'Widgets/TimerWidget',
  component: TimerWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof TimerWidget>;

export const Default: Story = {
  args: {
    displayTime: '0:45:30',
    sessionTypeLabel: 'PRACTICE',
    isCountdown: true,
  },
};

export const Race: Story = {
  args: {
    displayTime: '0:08:12',
    sessionTypeLabel: 'RACE',
    isCountdown: true,
  },
};

export const Elapsed: Story = {
  args: {
    displayTime: '1:23:45',
    sessionTypeLabel: 'PRACTICE',
    isCountdown: false,
  },
};

export const ZeroRemain: Story = {
  args: {
    displayTime: '0:00:00',
    sessionTypeLabel: 'QUALIFYING',
    isCountdown: true,
  },
};

export const NoData: Story = {
  args: {
    displayTime: '—',
    sessionTypeLabel: 'SESSION',
    isCountdown: false,
  },
};
