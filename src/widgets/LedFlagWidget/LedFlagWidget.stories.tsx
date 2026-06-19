import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagType } from '@/types';
import { LedFlagWidget } from './LedFlagWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

import type { FlagDisplaySettings } from '@/types/widget-settings';

const DESIGN_SIZE = 300;

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
  split: boolean;
  animate: boolean;
  forceSingleLed?: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/LedFlagWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: LedFlagWidget,
    size: { width: DESIGN_SIZE, height: DESIGN_SIZE, background: '#111' },
    seed: (store, args) => {
      store.flags.ledDisplayFlag = args.flag;
      const settings =
        store.widgetSettings.getSettings<FlagDisplaySettings>('led-flags');
      store.widgetSettings.updateUserSettings('led-flags', {
        ...settings,
        split: args.split,
        animate: args.animate,
        forceSingleLed: args.forceSingleLed,
      });
    },
    args: { flag: 'none', split: false, animate: true, forceSingleLed: false },
    argTypes: {
      flag: { control: 'select', options: ALL_FLAGS },
      split: { control: 'boolean' },
      animate: { control: 'boolean' },
      forceSingleLed: { control: 'boolean' },
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

export const SplitAnimated: Story = {
  args: { flag: 'yellow', split: true, animate: true },
  parameters: {
    widgetFrame: { width: 900, height: 300 },
  },
};

export const SplitRedFlagAnimated: Story = {
  args: { flag: 'red', split: true, animate: true },
  parameters: {
    widgetFrame: { width: 900, height: 300 },
  },
};

export const SmallRedFlagAnimated: Story = {
  args: { flag: 'red', split: false, animate: true },
  parameters: {
    widgetFrame: { width: 200, height: 200 },
  },
};

export const MediumRedFlagAnimated: Story = {
  args: { flag: 'red', split: false, animate: true },
  parameters: {
    widgetFrame: { width: 350, height: 350 },
  },
};

export const LargeMatrixRedFlag: Story = {
  args: { flag: 'red', split: false, animate: true },
  parameters: {
    widgetFrame: { width: 600, height: 600 },
  },
};

export const SingleLedMax: Story = {
  args: { flag: 'red', split: false, animate: true, forceSingleLed: true },
  parameters: {
    widgetFrame: { width: 600, height: 600 },
  },
};
