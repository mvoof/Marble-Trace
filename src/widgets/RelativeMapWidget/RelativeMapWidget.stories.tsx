import type { Meta, StoryObj } from '@storybook/react-vite';

import { LinearMap } from './LinearMap/LinearMap';
import { driverEntries as DRIVER_ENTRIES } from '@/storybook/test-data';
import { widgetDecorator } from '@/storybook/widgetDecorator';

const PLAYER_ENTRY = DRIVER_ENTRIES.find((entry) => entry.isPlayer) ?? null;

const meta: Meta<typeof LinearMap> = {
  title: 'Widgets/RelativeMapWidget',
  component: LinearMap,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 400, height: 40 })],
  args: {
    entries: DRIVER_ENTRIES,
    player: PLAYER_ENTRY,
    isHorizontal: true,
    playerDotColor: '#22c55e',
    targetDotRadiusPx: 6,
  },
};

export default meta;
type Story = StoryObj<typeof LinearMap>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  decorators: [widgetDecorator({ width: 40, height: 300 })],
  args: { isHorizontal: false },
};

export const CustomDotColor: Story = {
  args: { playerDotColor: '#f59e0b', targetDotRadiusPx: 8 },
};
