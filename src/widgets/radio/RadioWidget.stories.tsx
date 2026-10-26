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
  idleShowsChannel: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RadioWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RadioWidget,
    // The plate paints its own ground from --widget-bg and is as big as what
    // it holds; the frame around it stays empty, as the transparent container
    // does on the overlay.
    size: {
      width: 180,
      background: 'transparent',
      widgetBg: 'rgba(21, 22, 26, 0.8)',
      border: 'none',
    },
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

      store.liveWidgets.updateUserSettings('radio', {
        idleShowsChannel: args.idleShowsChannel,
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
      idleShowsChannel: false,
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

/** A moment after the player switches channel: the new channel alone. */
export const Retuned: Story = {
  args: {
    silent: true,
    retuned: true,
  },
};

/** Nobody talking, the widget kept up with the player's channel. */
export const IdleChannel: Story = {
  args: {
    silent: true,
    idleShowsChannel: true,
  },
};

export const Silent: Story = {
  args: {
    silent: true,
  },
};
