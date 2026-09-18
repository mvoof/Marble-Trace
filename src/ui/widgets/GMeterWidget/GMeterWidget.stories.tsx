import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  GMeterColorMode,
  GMeterDisplayMode,
} from '@/types/widget-settings';
import { G_ACCEL_MPS2, mockCarDynamics } from '@store/preview/mocks/dynamics';
import { GMeterWidget } from './GMeterWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  displayMode: GMeterDisplayMode;
  scale: 2 | 3 | 4 | 5;
  colorMode: GMeterColorMode;
  /**
   * The load on the car, in g. Left undefined — which is what a story naming a
   * scenario does — the scenario's own dynamics are kept.
   */
  latG?: number;
  longG?: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/GMeter',
  ...defineWidgetStories<StoryArgs>({
    widget: GMeterWidget,
    size: { width: 240, height: 240, background: 'rgba(21, 22, 26, 0.8)' },
    seed: (store, args) => {
      if (args.latG !== undefined || args.longG !== undefined) {
        store.player.updateCarDynamics(
          mockCarDynamics({
            lat_accel: (args.latG ?? 0) * G_ACCEL_MPS2,
            long_accel: (args.longG ?? 0) * G_ACCEL_MPS2,
          })
        );
      }

      store.liveWidgets.updateUserSettings('g-meter', {
        displayMode: args.displayMode,
        scale: args.scale,
        colorMode: args.colorMode,
      });
    },
    args: {
      displayMode: 'fading',
      scale: 4,
      colorMode: 'advanced',
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Idle: Story = { args: { latG: 0, longG: 0 } };

/** The load a fast corner actually puts on the car, as the scenario states it. */
export const HighG: Story = {
  parameters: previewScenario('high-g'),
};

export const HighSpeedCorner: Story = {
  args: { latG: 2.8, longG: -0.3 },
};

export const HeavyBraking: Story = {
  args: { latG: 0.1, longG: -3.1 },
};

export const HardAcceleration: Story = {
  args: { latG: -0.2, longG: 1.8 },
};

export const TrailMono: Story = {
  args: {
    displayMode: 'trail',
    scale: 3,
    colorMode: 'mono',
    latG: 2.1,
    longG: -1.2,
  },
};

export const PeakSimple: Story = {
  args: {
    displayMode: 'peak',
    scale: 2,
    colorMode: 'simple',
    latG: 1.9,
    longG: -2.5,
  },
};

export const FadingAdvanced: Story = {
  args: {
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
    latG: -2.6,
    longG: 0.8,
  },
};
