import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlatFlagsWidget } from './FlatFlagsWidget';
import { widgetDecorator } from '../../../stories/widgetDecorator';

const meta: Meta<typeof FlatFlagsWidget> = {
  title: 'Widgets/FlatFlagsWidget',
  component: FlatFlagsWidget,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 300 })],
  args: {
    flags: [],
    blinkOn: true,
  },
};

export default meta;
type Story = StoryObj<typeof FlatFlagsWidget>;

export const NoFlags: Story = {};

export const SingleGreen: Story = {
  args: { flags: ['green'] },
};

export const MultipleFlags: Story = {
  args: { flags: ['yellow', 'debris'] },
};

export const AllFlags: Story = {
  args: {
    flags: [
      'green',
      'yellow',
      'red',
      'blue',
      'white',
      'checkered',
      'black',
      'meatball',
      'debris',
    ],
  },
};

export const BlinkOff: Story = {
  args: {
    flags: ['yellow', 'red'],
    blinkOn: false,
  },
};
