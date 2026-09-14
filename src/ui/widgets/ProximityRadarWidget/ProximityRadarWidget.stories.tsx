import type { Meta, StoryObj } from '@storybook/react-vite';

import type { MockTrafficCar } from '@store/preview/mocks/traffic';
import { mockProximity } from '@store/preview/mocks/traffic';
import { ProximityRadarWidget } from './ProximityRadarWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /**
   * The cars around the player. Left undefined — which is what a story naming
   * a scenario does — the scenario's own traffic is kept; a story states this
   * only for an arrangement no scenario covers. The clearance, the bumper gaps
   * and the four radar distances are the builder's, derived the way the
   * backend derives them.
   */
  cars?: MockTrafficCar[];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/ProximityRadarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: ProximityRadarWidget,
    size: { width: 180, height: 180 },
    seed: (store, args) => {
      store.appSettings.dragMode = true;

      if (args.cars !== undefined) {
        store.backendComputed.updateProximity(mockProximity(args.cars));
      }
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const NoCars: Story = { args: { cars: [] } };

export const CarLeft: Story = { parameters: previewScenario('traffic-left') };
export const CarRight: Story = { parameters: previewScenario('traffic-right') };

export const CarsBothSides: Story = {
  parameters: previewScenario('traffic-three-wide'),
};

export const CarBehind: Story = {
  parameters: previewScenario('traffic-rear-bumper'),
};

export const Surrounded: Story = {
  parameters: previewScenario('radar-traffic'),
};

export const CarAhead: Story = {
  args: { cars: [{ carIdx: 3, longitudinalDist: 8, side: 'center' }] },
};

/** Two alongside in the same row — one body carrying a `×2`. */
export const TwoCarsOneSide: Story = {
  args: {
    cars: [
      { carIdx: 1, longitudinalDist: 0.4, side: 'left' },
      { carIdx: 5, longitudinalDist: 1.1, side: 'left' },
    ],
  },
};

/** A queue alongside: drawn where each car really is along the lane. */
export const QueueAlongside: Story = {
  args: {
    cars: [
      { carIdx: 1, longitudinalDist: 0.5, side: 'right' },
      { carIdx: 5, longitudinalDist: -5.5, side: 'right' },
    ],
  },
};
