import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagType } from '@/types';
import { FlatFlagsWidget } from './FlatFlagsWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const ALL_FLAGS: FlagType[] = [
  'green',
  'yellow',
  'red',
  'blue',
  'white',
  'checkered',
  'black',
  'debris',
];

interface StoryArgs {
  flags: FlagType[];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/FlatFlagsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: FlatFlagsWidget,
    size: { width: 300 },
    seed: (store, args) => {
      store.flags.displayFlags = args.flags;
    },
    args: { flags: [] },
    argTypes: {
      flags: { control: 'check', options: ALL_FLAGS },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const NoFlags: Story = {};

export const SingleGreen: Story = { args: { flags: ['green'] } };
export const Yellow: Story = { args: { flags: ['yellow'] } };
export const MultipleFlags: Story = { args: { flags: ['yellow', 'debris'] } };
export const AllFlags: Story = { args: { flags: ALL_FLAGS } };
