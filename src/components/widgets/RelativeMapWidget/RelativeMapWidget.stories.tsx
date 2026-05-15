import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelativeMapWidget } from './RelativeMapWidget';
import { driverEntries as DRIVER_ENTRIES } from '../../../storybook/test-data';
import { widgetDecorator } from '../../../stories/widgetDecorator';

const DEFAULT_SETTINGS = {
  orientation: 'horizontal' as const,
  playerDotColor: '#22c55e',
  targetDotRadiusPx: 6,
};

const meta: Meta<typeof RelativeMapWidget> = {
  title: 'Widgets/RelativeMapWidget',
  component: RelativeMapWidget,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 400, height: 40 })],
  args: {
    entries: DRIVER_ENTRIES,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof RelativeMapWidget>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  decorators: [widgetDecorator({ width: 40, height: 300 })],
  args: {
    settings: { ...DEFAULT_SETTINGS, orientation: 'vertical' },
  },
};

export const CustomDotColor: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      playerDotColor: '#f59e0b',
      targetDotRadiusPx: 8,
    },
  },
};
