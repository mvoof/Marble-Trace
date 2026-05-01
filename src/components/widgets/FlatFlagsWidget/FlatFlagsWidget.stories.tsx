import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlatFlagsWidget } from './FlatFlagsWidget';
import type { FlagType } from '../../../types/flags';

interface FlatFlagsWidgetStoryArgs {
  flags: FlagType[];
  blinkOn: boolean;
}

const FlatFlagsWidgetStory = ({ flags, blinkOn }: FlatFlagsWidgetStoryArgs) => (
  <div style={{ background: '#050507', padding: 32, width: 300 }}>
    <FlatFlagsWidget flags={flags} blinkOn={blinkOn} />
  </div>
);

const meta: Meta<FlatFlagsWidgetStoryArgs> = {
  title: 'Widgets/FlatFlagsWidget',
  component: FlatFlagsWidgetStory,
  parameters: { layout: 'centered' },
  args: {
    flags: [],
    blinkOn: true,
  },
};

export default meta;

type Story = StoryObj<FlatFlagsWidgetStoryArgs>;

export const NoFlags: Story = { args: { flags: [] } };
export const Green: Story = { args: { flags: ['green'] } };
export const Yellow: Story = { args: { flags: ['yellow'] } };
export const YellowBlink: Story = {
  args: { flags: ['yellow'], blinkOn: false },
};
export const Red: Story = { args: { flags: ['red'] } };
export const Blue: Story = { args: { flags: ['blue'] } };
export const White: Story = { args: { flags: ['white'] } };
export const Checkered: Story = { args: { flags: ['checkered'] } };
export const Black: Story = { args: { flags: ['black'] } };
export const Meatball: Story = { args: { flags: ['meatball'] } };
export const Debris: Story = { args: { flags: ['debris'] } };
export const MultipleFlags: Story = {
  args: { flags: ['yellow', 'blue', 'debris'] },
};
