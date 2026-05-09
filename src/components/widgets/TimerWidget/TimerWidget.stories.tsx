import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimerWidget } from './TimerWidget';

const meta: Meta<typeof TimerWidget> = {
  title: 'Widgets/TimerWidget',
  component: TimerWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
          display: 'inline-block',
          minWidth: 180,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    sessionTypeLabel: 'RACE',
    flagState: 'green',
    timeMain: '42',
    timeSeconds: ':18',
    currentLap: 12,
    totalLaps: '30',
    position: 5,
    totalDrivers: 24,
    sessionEnded: false,
    showFlag: true,
    showLaps: true,
    showPosition: true,
    showWallClock: false,
    showSimTime: false,
    showPcDate: false,
    showSimDate: false,
    wallClockTime: '14:23',
    simTime: null,
    pcDate: '2026-05-09',
    simDate: null,
  },
};

export default meta;
type Story = StoryObj<typeof TimerWidget>;

export const Practice: Story = {
  args: {
    sessionTypeLabel: 'PRACTICE',
    flagState: 'green',
    timeMain: '18',
    timeSeconds: ':42',
    currentLap: null,
    totalLaps: null,
    position: null,
    totalDrivers: null,
    showLaps: false,
    showPosition: false,
  },
};

export const RaceGreen: Story = {};

export const FinalMinutes: Story = {
  args: {
    flagState: 'final',
    timeMain: '4',
    timeSeconds: ':55',
  },
};

export const Checkered: Story = {
  args: {
    flagState: 'checkered',
    timeMain: '0',
    timeSeconds: ':00',
    currentLap: 30,
  },
};

export const SessionEnded: Story = {
  args: {
    sessionEnded: true,
  },
};

export const WithClocks: Story = {
  args: {
    showWallClock: true,
    showSimTime: true,
    wallClockTime: '14:23',
    simTime: '16:00',
  },
};

export const MinimalView: Story = {
  args: {
    showFlag: false,
    showLaps: false,
    showPosition: false,
  },
};

export const WithLapsAndPosition: Story = {
  args: {
    showLaps: true,
    showPosition: true,
    currentLap: 12,
    totalLaps: '30',
    position: 3,
    totalDrivers: 24,
  },
};
