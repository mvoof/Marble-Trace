import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlagsWidget } from './FlagsWidget';
import type { FlagType } from '../../../types/flags';

interface FlagsWidgetStoryArgs {
  flag: FlagType;
  blinkOn: boolean;
}

const FlagsWidgetStory = ({ flag, blinkOn }: FlagsWidgetStoryArgs) => (
  <div style={{ background: '#050507', padding: 32, display: 'inline-block' }}>
    <FlagsWidget flag={flag} blinkOn={blinkOn} />
  </div>
);

const meta: Meta<FlagsWidgetStoryArgs> = {
  title: 'Widgets/FlagsWidget',
  component: FlagsWidgetStory,
  parameters: { layout: 'centered' },
  args: {
    flag: 'none',
    blinkOn: true,
  },
};

export default meta;

type Story = StoryObj<FlagsWidgetStoryArgs>;

export const None: Story = { args: { flag: 'none' } };
export const Green: Story = { args: { flag: 'green' } };
export const Yellow: Story = { args: { flag: 'yellow' } };
export const YellowBlink: Story = { args: { flag: 'yellow', blinkOn: false } };
export const Red: Story = { args: { flag: 'red' } };
export const Blue: Story = { args: { flag: 'blue' } };
export const White: Story = { args: { flag: 'white' } };
export const Checkered: Story = { args: { flag: 'checkered' } };
export const Black: Story = { args: { flag: 'black' } };
export const Meatball: Story = { args: { flag: 'meatball' } };
export const Debris: Story = { args: { flag: 'debris' } };
