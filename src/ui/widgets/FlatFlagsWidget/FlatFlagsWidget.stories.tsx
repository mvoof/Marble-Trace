import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagType } from '@/types';
import { FlatFlagsWidget } from './FlatFlagsWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

const ALL_FLAGS: FlagType[] = [
  'green',
  'yellow',
  'red',
  'blue',
  'white',
  'checkered',
  'black',
  'debris',
  'sc',
  'dq',
];

interface StoryArgs {
  /**
   * The flags on display. Left undefined — which is what a story naming a
   * scenario does — the scenario's own flags are kept; a story states this
   * only for a combination the sim raises that no scenario covers.
   */
  flags?: FlagType[];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/FlatFlagsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: FlatFlagsWidget,
    size: { width: 300 },
    seed: (store, args) => {
      if (args.flags !== undefined) {
        store.flags.displayFlags = args.flags;
      }
    },
    argTypes: {
      flags: { control: 'check', options: ALL_FLAGS },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const NoFlags: Story = { args: { flags: [] } };

export const SingleGreen: Story = { parameters: previewScenario('green-flag') };
export const Yellow: Story = { parameters: previewScenario('yellow-flag') };
export const SafetyCar: Story = { parameters: previewScenario('safety-car') };
export const DqFlag: Story = { parameters: previewScenario('dq-flag') };

// The two combinations no scenario states: a local yellow with debris under it,
// and every flag at once — the row the widget has to stay readable at.
export const MultipleFlags: Story = { args: { flags: ['yellow', 'debris'] } };
export const AllFlags: Story = { args: { flags: ALL_FLAGS } };
