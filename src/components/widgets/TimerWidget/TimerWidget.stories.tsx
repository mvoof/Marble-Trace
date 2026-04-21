import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimerWidget } from './TimerWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 120;

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

export const Race: Story = {
  args: {
    sessionTypeLabel: 'RACE',
    flagState: 'green',
    timeMain: '00:45:',
    timeSeconds: '12',
    currentLap: 12,
    totalLaps: '38',
    position: 4,
    totalDrivers: 28,
  },
};

export const FinalMinutes: Story = {
  args: {
    sessionTypeLabel: 'RACE',
    flagState: 'final',
    timeMain: '00:04:',
    timeSeconds: '22',
    currentLap: 35,
    totalLaps: '38',
    position: 2,
    totalDrivers: 28,
  },
};

export const Checkered: Story = {
  args: {
    sessionTypeLabel: 'RACE',
    flagState: 'checkered',
    timeMain: '00:00:',
    timeSeconds: '00',
    currentLap: 38,
    totalLaps: '38',
    position: 1,
    totalDrivers: 28,
  },
};

export const Practice: Story = {
  args: {
    sessionTypeLabel: 'PRACTICE',
    flagState: 'green',
    timeMain: '00:18:',
    timeSeconds: '45',
    currentLap: 3,
    totalLaps: 'unlimited',
    position: null,
    totalDrivers: null,
  },
};

export const NoData: Story = {
  args: {
    sessionTypeLabel: 'SESSION',
    flagState: 'green',
    timeMain: '00:00:',
    timeSeconds: '00',
    currentLap: null,
    totalLaps: null,
    position: null,
    totalDrivers: null,
  },
};
