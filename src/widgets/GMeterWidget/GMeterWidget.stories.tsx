import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  GMeterColorMode,
  GMeterDisplayMode,
} from '@/types/widget-settings';
import { GMeterWidget } from './GMeterWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const G_CONSTANT = 9.80665;

interface StoryArgs {
  displayMode: GMeterDisplayMode;
  scale: 2 | 3 | 4 | 5;
  colorMode: GMeterColorMode;
  latG: number;
  longG: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/GMeter',
  ...defineWidgetStories<StoryArgs>({
    widget: GMeterWidget,
    size: { width: 240, height: 280, background: 'rgba(21, 22, 26, 0.8)' },
    seed: (store, args) => {
      store.telemetry.updateCarDynamics({
        lat_accel: args.latG * G_CONSTANT,
        long_accel: args.longG * G_CONSTANT,
      } as Parameters<typeof store.telemetry.updateCarDynamics>[0]);

      store.widgetSettings.updateUserSettings('g-meter', {
        displayMode: args.displayMode,
        scale: args.scale,
        colorMode: args.colorMode,
      });
    },
    args: {
      displayMode: 'fading',
      scale: 4,
      colorMode: 'advanced',
      latG: 0,
      longG: 0,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Idle: Story = {};

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
