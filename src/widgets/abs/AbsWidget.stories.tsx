import type { Meta, StoryObj } from '@storybook/react-vite';

import { mockCarStatus } from '@features/preview/mocks/engine';
import { mockCarInputs } from '@features/preview/mocks/inputs';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { AbsWidget } from './AbsWidget';

interface StoryArgs {
  absActive: boolean;
  /** The cockpit setting; 0 with `noAdjustment` off is a car set to ABS off. */
  level: number;
  /** A car with no ABS adjustment — the level reads `--`. */
  noAdjustment: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/AbsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: AbsWidget,
    size: { width: 150, height: 52 },
    seed: (store, args) => {
      store.player.updateCarStatus(
        mockCarStatus({ dc_abs: args.noAdjustment ? null : args.level })
      );
      store.player.updateCarInputs(
        mockCarInputs({ brake: 0.9, brake_abs_active: args.absActive })
      );
    },
    args: {
      absActive: true,
      level: 6,
      noAdjustment: false,
    },
    argTypes: {
      level: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** Hard on the brakes into a corner, ABS working. */
export const Active: Story = {};

/** The resting state: the badge goes quiet. */
export const Idle: Story = {
  args: {
    absActive: false,
  },
};

export const TwoDigitLevel: Story = {
  args: {
    level: 12,
  },
};

export const NoAdjustment: Story = {
  args: {
    absActive: false,
    noAdjustment: true,
  },
};

/** The level switched off: the badge alone, square-cut, the light only. */
export const BadgeOnly: Story = {
  args: {
    showLevel: false,
  },
  parameters: { widgetFrame: { width: 92 } },
};
