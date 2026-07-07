import type { Meta, StoryObj } from '@storybook/react-vite';

import type { DrivingAdvisory } from '@store/widgets/driving-coach-utils';
import type { ReferenceLapData } from '@/types/bindings';
import { DrivingCoachWidget } from './DrivingCoachWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  advisory: DrivingAdvisory;
  referenceKmh: number;
  deltaKmh: number;
}

const REFERENCE_BUCKET_COUNT = 1000;

const buildReferenceLap = (referenceMps: number): ReferenceLapData => ({
  trackId: 0,
  carScreenName: 'Preview Car',
  lapTime: 90,
  samples: Array.from({ length: REFERENCE_BUCKET_COUNT }, () => ({
    speed: referenceMps,
    throttle: 1,
    brake: 0,
  })),
});

const meta: Meta<StoryArgs> = {
  title: 'Widgets/DrivingCoachWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: DrivingCoachWidget,
    size: { width: 240, height: 120 },
    seed: (store, args) => {
      // Drag mode forces the widget to render even when idle with no reference
      // (matches the real overlay's editing behavior).
      store.appSettings.dragMode = true;
      store.drivingCoachWidget.displayedAdvisory = args.advisory;

      const referenceMps = args.referenceKmh / 3.6;
      store.referenceLap.updateReferenceLap(buildReferenceLap(referenceMps));

      const lapTiming = store.player.lapTiming;

      if (lapTiming) {
        store.player.updateLapTiming({ ...lapTiming, lap_dist_pct: 0.5 });
      }

      const carDynamics = store.player.carDynamics;

      if (carDynamics) {
        store.player.updateCarDynamics({
          ...carDynamics,
          speed: (args.referenceKmh + args.deltaKmh) / 3.6,
        });
      }
    },
    args: { advisory: 'neutral', referenceKmh: 200, deltaKmh: -6 },
    argTypes: {
      advisory: {
        control: 'radio',
        options: ['neutral', 'brake', 'gas'],
      },
      referenceKmh: { control: { type: 'number' } },
      deltaKmh: { control: { type: 'number' } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

// Idle with a reference lap loaded — shows the reference speed + delta without
// an advisory banner.
export const Idle: Story = {};

export const Brake: Story = {
  args: { advisory: 'brake', referenceKmh: 198, deltaKmh: 12 },
};

export const Gas: Story = {
  args: { advisory: 'gas', referenceKmh: 205, deltaKmh: -8 },
};
