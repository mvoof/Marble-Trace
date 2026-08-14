import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  InvisibleDashRenderMode,
  InvisibleDashWidgetSettings,
} from '@/types/widget-settings';
import { InvisibleDashWidget } from './InvisibleDashWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  speedKmh: number;
  rpm: number;
  gear: number;
  depth: number;
  renderMode: InvisibleDashRenderMode;
  backdropColor: string;
  bloomIntensity: number;
}

const MPS_PER_KMH = 3.6;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/InvisibleDashWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: InvisibleDashWidget,
    seedSnapshot: true,
    size: {
      width: 900,
      height: 200,
      background: 'transparent',
      widgetBg: 'transparent',
      border: 'none',
    },
    seed: (store, args) => {
      store.widgetSettings.updateUserSettings('invisible-dash', {
        depth: args.depth,
        renderMode: args.renderMode,
        backdropColor: args.backdropColor,
        bloomIntensity: args.bloomIntensity,
      } as Partial<InvisibleDashWidgetSettings>);

      const carDynamics = store.player.carDynamics;

      if (carDynamics) {
        store.player.updateCarDynamics({
          ...carDynamics,
          speed: args.speedKmh / MPS_PER_KMH,
          rpm: args.rpm,
          gear: args.gear,
        });
      }
    },
    args: {
      speedKmh: 247,
      rpm: 6840,
      gear: 5,
      depth: 45,
      renderMode: 'projection',
      backdropColor: 'rgba(0, 0, 0, 0)',
      bloomIntensity: 60,
    },
    argTypes: {
      speedKmh: { control: { type: 'number' } },
      rpm: { control: { type: 'number' } },
      gear: { control: { type: 'number' } },
      depth: { control: { type: 'range', min: 0, max: 100, step: 5 } },
      renderMode: { control: 'radio', options: ['projection', 'contour'] },
      backdropColor: { control: 'color' },
      bloomIntensity: { control: { type: 'range', min: 0, max: 100, step: 5 } },
      backdropOpacity: {
        control: { type: 'range', min: 0, max: 100, step: 5 },
      },
      backdropSoftness: {
        control: { type: 'range', min: 0, max: 100, step: 5 },
      },
    },
  }),
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Flat: Story = {
  args: { depth: 0 },
};

export const FarProjection: Story = {
  args: { depth: 90 },
};

// Contour is what a bright track needs — the bloom washes out on white concrete.
export const Contour: Story = {
  args: { renderMode: 'contour' },
};

// A tinted, blurred plate is what makes the strip readable over a busy
// background — trees, kerbs, a car right in front.
export const BackdropPlate: Story = {
  args: { backdropColor: 'rgba(0, 0, 0, 0.55)' },
};

export const ShiftZone: Story = {
  args: { rpm: 8400, gear: 6, speedKmh: 291 },
};
