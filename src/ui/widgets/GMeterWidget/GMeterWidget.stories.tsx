import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  GMeterColorMode,
  GMeterDisplayMode,
} from '@/types/widget-settings';
import { G_ACCEL_MPS2, mockCarDynamics } from '@store/preview/mocks/dynamics';
import type { RendererCore } from '@store/roots/renderer-core';
import { GMeterWidget } from './GMeterWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';
import { withReplay } from '@/storybook/with-replay';

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
    size: {
      width: 240,
      height: 240,
      background: 'transparent',
      border: 'none',
    },
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

// One corner at 60 Hz: brake in a straight line, turn in trailing off the
// brake, hold the lateral load through the apex, and power out of it
const CORNER_SAMPLES = 240;
const SAMPLES_PER_SECOND = 60;
const CORNER_SECONDS = CORNER_SAMPLES / SAMPLES_PER_SECOND;
const PEAK_BRAKE_G = 2.6;
const PEAK_LATERAL_G = 2.3;
const PEAK_EXIT_G = 0.9;
// Shares of the corner, 0 to 1: braking fades out over its first part, the
// power comes in from EXIT_START on
const BRAKE_SPAN = 0.62;
const EXIT_START = 0.55;
const EXIT_SPAN = 0.45;

const replayCorner = (store: RendererCore): void => {
  for (let index = 0; index < CORNER_SAMPLES; index++) {
    const phase = index / SAMPLES_PER_SECOND / CORNER_SECONDS;
    const braking = Math.max(0, Math.cos((phase / BRAKE_SPAN) * (Math.PI / 2)));
    const cornering = Math.sin(phase * Math.PI);
    const exiting = Math.max(
      0,
      Math.sin(((phase - EXIT_START) / EXIT_SPAN) * (Math.PI / 2))
    );

    store.player.updateCarDynamics(
      mockCarDynamics({
        lat_accel: cornering * PEAK_LATERAL_G * G_ACCEL_MPS2,
        long_accel:
          (exiting * PEAK_EXIT_G - braking * PEAK_BRAKE_G) * G_ACCEL_MPS2,
      })
    );
  }
};

/** A corner's worth of load already on the dial, as on the site. */
export const Showcase: Story = {
  args: {
    scale: 2,
  },

  decorators: [withReplay(replayCorner)],
};

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
