import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  InvisibleDashBackdropScope,
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
  curvature: number;
  renderMode: InvisibleDashRenderMode;
  backdropColor: string;
  backdropScope: InvisibleDashBackdropScope;
  bloomIntensity: number;
}

const MPS_PER_KMH = 3.6;
const DESIGN_WIDTH = 900;
const DESIGN_HEIGHT = 200;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/InvisibleDashWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: InvisibleDashWidget,
    seedSnapshot: true,
    size: {
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      background: 'transparent',
      widgetBg: 'transparent',
      border: 'none',
    },
    seed: (store, args) => {
      store.widgetSettings.updateUserSettings('invisible-dash', {
        depth: args.depth,
        curvature: args.curvature,
        renderMode: args.renderMode,
        backdropColor: args.backdropColor,
        backdropScope: args.backdropScope,
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
      curvature: 30,
      renderMode: 'projection',
      backdropColor: 'rgba(0, 0, 0, 0)',
      backdropScope: 'clusters',
      bloomIntensity: 60,
    },
    argTypes: {
      speedKmh: { control: { type: 'number' } },
      rpm: { control: { type: 'number' } },
      gear: { control: { type: 'number' } },
      depth: { control: { type: 'range', min: 0, max: 100, step: 5 } },
      curvature: { control: { type: 'range', min: 0, max: 100, step: 5 } },
      renderMode: { control: 'radio', options: ['projection', 'contour'] },
      backdropColor: { control: 'color' },
      backdropScope: { control: 'radio', options: ['clusters', 'full'] },
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

// One plate behind the whole strip instead of one per cluster — it lies in the
// strip's own tilted plane, so it foreshortens along with the digits.
export const FullBackdrop: Story = {
  args: { backdropColor: 'rgba(0, 0, 0, 0.55)', backdropScope: 'full' },
};

// Half width at the same height: the digits stay exactly the size they are in
// Default and the clusters keep the two edges — all the narrowing has eaten is
// the empty middle.
export const Compact: Story = {
  parameters: { widgetFrame: { width: 440 } },
};

// Narrow enough that the clusters have met. Nothing is dropped, the insets are
// just at their tightest.
export const Tight: Story = {
  parameters: { widgetFrame: { width: 355 } },
};

// The glass at its most wrapped — the sides turn away and climb to the pillars.
export const Curved: Story = {
  args: { curvature: 100 },
};

// Flat glass: the readout is one straight plane, curvature off.
export const FlatGlass: Story = {
  args: { curvature: 0 },
};

export const ShiftZone: Story = {
  args: { rpm: 8400, gear: 6, speedKmh: 291 },
};
