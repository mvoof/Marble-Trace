import type { Meta, StoryObj } from '@storybook/react-vite';

import { mockRadioTransmission } from '@features/preview/mocks/radio';
import type { RadioChannel } from '@shared/contracts/generated/bindings';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { RadioWidget } from './RadioWidget';

interface StoryArgs {
  channel: RadioChannel;
  /** Nobody on the air — the quiet plate the layout editor shows. */
  silent: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RadioWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RadioWidget,
    size: { width: 200, height: 150 },
    seedSnapshot: true,
    seed: (store, args) => {
      store.cars.updateRadio({
        transmission: args.silent
          ? null
          : mockRadioTransmission(store.session.sessionInfo, args.channel),
      });
    },
    args: {
      channel: 'all',
      silent: false,
    },
    argTypes: {
      channel: {
        control: { type: 'select' },
        options: ['all', 'team', 'raceControl', 'club', 'other'],
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** A driver talking to everyone — the race look. */
export const AllDrivers: Story = {};

export const Team: Story = {
  args: {
    channel: 'team',
  },
};

export const RaceControl: Story = {
  args: {
    channel: 'raceControl',
  },
};

export const Silent: Story = {
  args: {
    silent: true,
  },
};
