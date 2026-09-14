import type { Meta, StoryObj } from '@storybook/react-vite';

import type { MockTrafficCar } from '@store/preview/mocks/traffic';
import { mockProximity } from '@store/preview/mocks/traffic';
import { RadarBarWidget } from './RadarBarWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /**
   * The cars around the player. Left undefined — which is what a story naming
   * a scenario does — the scenario's own traffic is kept. The bar reads the
   * four radar distances and the two spotter flags, and the builder derives
   * all six from these cars the way the backend derives them, so a story
   * cannot state a side distance its own traffic denies.
   */
  cars?: MockTrafficCar[];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RadarBarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RadarBarWidget,
    size: { width: 800, height: 380 },
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

export const Default: Story = { args: { cars: [] } };

export const CarLeft: Story = { parameters: previewScenario('traffic-left') };
export const CarRight: Story = { parameters: previewScenario('traffic-right') };

export const BothSides: Story = {
  parameters: previewScenario('traffic-three-wide'),
};

// Overlapping mirror to mirror — the closest the side pill ever reads.
export const VeryClose: Story = {
  args: { cars: [{ carIdx: 7, longitudinalDist: 0.3, side: 'left' }] },
};
