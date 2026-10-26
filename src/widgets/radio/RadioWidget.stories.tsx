import type { Meta, StoryObj } from '@storybook/react-vite';

import { mockRadioTransmission } from '@features/preview/mocks/radio';
import type { RadioChannel } from '@shared/contracts/generated/bindings';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { RadioWidget } from './RadioWidget';
import type { RadioWidgetStore } from './radio.store';

interface StoryArgs {
  channel: RadioChannel;
  /** Nobody on the air — the quiet plate the layout editor shows. */
  silent: boolean;
  /** The player holding push-to-talk, placed on the air by the backend. */
  player: boolean;
  /** The player just switched channel, nobody talking. */
  retuned: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RadioWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RadioWidget,
    size: { width: 180, height: 112 },
    seedSnapshot: true,
    seed: (store, args) => {
      store.cars.updateRadio({
        transmission: args.silent
          ? null
          : mockRadioTransmission(
              store.session.sessionInfo,
              args.channel,
              args.player ? store.session.sessionInfo?.playerCarIdx : undefined
            ),
        pushToTalk: args.player,
      });

      store.widgetInstances.seed<RadioWidgetStore>('radio', (radio) => {
        radio.retuneShown = args.retuned;
      });
    },
    args: {
      channel: 'all',
      silent: false,
      player: false,
      retuned: false,
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

/** The player talking to the team. */
export const Player: Story = {
  args: {
    channel: 'team',
    player: true,
  },
};

/** A moment after the player switches channel: the plate, the wave still. */
export const Retuned: Story = {
  args: {
    silent: true,
    retuned: true,
  },
};

export const Silent: Story = {
  args: {
    silent: true,
  },
};
