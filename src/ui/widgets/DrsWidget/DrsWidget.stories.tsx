import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  mockCarStatus,
  mockHybridCarStatus,
} from '@store/preview/mocks/engine';
import type { DrsState } from '@/types/bindings';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { DrsWidget } from './DrsWidget';

interface StoryArgs {
  state: DrsState;
  /** A car with no DRS at all — the widget renders nothing. */
  noDrs: boolean;
  hideWhenUnavailable: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/DrsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: DrsWidget,
    size: { width: 215, height: 56 },
    seed: (store, args) => {
      store.player.updateCarStatus(
        args.noDrs ? mockCarStatus() : mockHybridCarStatus({ drs: args.state })
      );

      store.liveWidgets.updateUserSettings('drs', {
        hideWhenUnavailable: args.hideWhenUnavailable,
      });
    },
    args: {
      state: 'Ready',
      noDrs: false,
      hideWhenUnavailable: false,
    },
    argTypes: {
      state: {
        control: { type: 'select' },
        options: ['Unavailable', 'Armed', 'Ready', 'Open'],
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** Outside a zone, or the rules say no. The resting state. */
export const Unavailable: Story = {
  args: {
    state: 'Unavailable',
  },
};

/** Past the detection point, zone still ahead — the button does nothing yet. */
export const Armed: Story = {
  args: {
    state: 'Armed',
  },
};

export const Ready: Story = {};

export const Open: Story = {
  args: {
    state: 'Open',
  },
};

export const HiddenWhileUnavailable: Story = {
  args: {
    state: 'Unavailable',
    hideWhenUnavailable: true,
  },
};

/** A GT3. Nothing renders, which is the point. */
export const CarWithoutDrs: Story = {
  args: {
    noDrs: true,
  },
};
