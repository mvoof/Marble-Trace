import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagType } from '@/types';
import { LedFlagWidget } from './LedFlagWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const DESIGN_SIZE = 160;

const ALL_FLAGS: FlagType[] = [
  'none',
  'green',
  'yellow',
  'red',
  'blue',
  'white',
  'checkered',
  'black',
  'meatball',
  'debris',
];

interface StoryArgs {
  flag: FlagType;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/LedFlagWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: LedFlagWidget,
    size: { width: DESIGN_SIZE, height: DESIGN_SIZE, background: '#111' },
    seed: (store, args) => {
      store.flags.ledDisplayFlag = args.flag;
    },
    args: { flag: 'none' },
    argTypes: {
      flag: { control: 'select', options: ALL_FLAGS },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const NoFlag: Story = {};

export const GreenFlag: Story = { args: { flag: 'green' } };
export const YellowFlag: Story = { args: { flag: 'yellow' } };
export const RedFlag: Story = { args: { flag: 'red' } };
export const BlueFlag: Story = { args: { flag: 'blue' } };
export const WhiteFlag: Story = { args: { flag: 'white' } };
export const CheckeredFlag: Story = { args: { flag: 'checkered' } };
export const BlackFlag: Story = { args: { flag: 'black' } };
export const MeatballFlag: Story = { args: { flag: 'meatball' } };
export const DebrisFlag: Story = { args: { flag: 'debris' } };
