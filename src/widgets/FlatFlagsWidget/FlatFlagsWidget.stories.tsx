import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagType } from '@/types';
import { FlatFlagsWidget } from './FlatFlagsWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const meta: Meta<typeof FlatFlagsWidget> = {
  title: 'Widgets/FlatFlagsWidget',
  component: FlatFlagsWidget,
  parameters: { layout: 'centered' },
  decorators: [withStore(), widgetDecorator({ width: 300 })],
};

export default meta;
type Story = StoryObj<typeof FlatFlagsWidget>;

const flagStory = (...flags: FlagType[]): Story => ({
  decorators: [
    withStore((store) => {
      store.flags.displayFlags = flags;
    }),
    widgetDecorator({ width: 300 }),
  ],
});

export const NoFlags: Story = {};

export const SingleGreen: Story = flagStory('green');
export const Yellow: Story = flagStory('yellow');
export const MultipleFlags: Story = flagStory('yellow', 'debris');
export const AllFlags: Story = flagStory(
  'green',
  'yellow',
  'red',
  'blue',
  'white',
  'checkered',
  'black',
  'debris'
);
