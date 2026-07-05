import type { Meta, StoryObj } from '@storybook/react-vite';

import type { DrivingAdvisory } from '@store/widgets/driving-coach-utils';
import { DrivingCoachWidget } from './DrivingCoachWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  advisory: DrivingAdvisory;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/DrivingCoachWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: DrivingCoachWidget,
    size: { width: 400 },
    seed: (store, args) => {
      store.drivingCoachWidget.displayedAdvisory = args.advisory;
    },
    args: { advisory: 'neutral' },
    argTypes: {
      advisory: {
        control: 'radio',
        options: ['neutral', 'brake', 'gas'],
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Neutral: Story = {};
export const Brake: Story = { args: { advisory: 'brake' } };
export const Gas: Story = { args: { advisory: 'gas' } };
