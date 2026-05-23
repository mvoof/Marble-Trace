import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagType } from '@/types';
import { LedFlagWidget } from './LedFlagWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const DESIGN_SIZE = 160;

const meta: Meta<typeof LedFlagWidget> = {
  title: 'Widgets/LedFlagWidget',
  component: LedFlagWidget,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({
      width: DESIGN_SIZE,
      height: DESIGN_SIZE,
      background: '#111',
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof LedFlagWidget>;

const flagStory = (flag: FlagType): Story => ({
  decorators: [
    withStore((store) => {
      store.flags.ledDisplayFlag = flag;
    }),
    widgetDecorator({
      width: DESIGN_SIZE,
      height: DESIGN_SIZE,
      background: '#111',
    }),
  ],
});

export const NoFlag: Story = {};

export const GreenFlag: Story = flagStory('green');
export const YellowFlag: Story = flagStory('yellow');
export const RedFlag: Story = flagStory('red');
export const BlueFlag: Story = flagStory('blue');
export const WhiteFlag: Story = flagStory('white');
export const CheckeredFlag: Story = flagStory('checkered');
export const BlackFlag: Story = flagStory('black');
export const MeatballFlag: Story = flagStory('meatball');
export const DebrisFlag: Story = flagStory('debris');
