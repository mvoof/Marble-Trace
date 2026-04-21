import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SessionWidget } from './SessionWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 300;
const DESIGN_HEIGHT = 100;

const wrap = (props: ComponentProps<typeof SessionWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <SessionWidget {...props} />
    </WidgetScaler>
  </div>
);

const meta: Meta<typeof SessionWidget> = {
  title: 'Widgets/SessionWidget',
  component: SessionWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof SessionWidget>;

export const Practice: Story = {
  args: {
    sessionTypeLabel: 'PRACTICE',
    contextLabel: 'TIME REMAINING',
    contextValue: '0:35:00',
  },
};

export const Qualifying: Story = {
  args: {
    sessionTypeLabel: 'QUALIFYING',
    contextLabel: 'TIME REMAINING',
    contextValue: '0:04:30',
  },
};

export const RaceLapBased: Story = {
  args: {
    sessionTypeLabel: 'RACE',
    contextLabel: 'LAP',
    contextValue: '8 / 30',
  },
};

export const RaceTimeBased: Story = {
  args: {
    sessionTypeLabel: 'RACE',
    contextLabel: 'TIME REMAINING',
    contextValue: '1:12:00',
  },
};

export const Unlimited: Story = {
  args: {
    sessionTypeLabel: 'PRACTICE',
    contextLabel: 'TIME ELAPSED',
    contextValue: '0:22:15',
  },
};

export const NoData: Story = {
  args: {
    sessionTypeLabel: 'SESSION',
    contextLabel: 'TIME REMAINING',
    contextValue: '—',
  },
};
