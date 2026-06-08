import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ProximityFrame, RadarDistances } from '@/types/bindings';
import { RadarBarWidget } from './RadarBarWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  radarDistances: RadarDistances;
  spotterLeft: boolean;
  spotterRight: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RadarBarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RadarBarWidget,
    size: { width: 800, height: 380 },
    seed: (store, args) => {
      store.appSettings.dragMode = true;

      store.widgetSettings.updateUserSettings('radar-bar', {
        proximityThreshold: 3,
        hideDelay: 2,
      });

      store.backendComputed.updateProximity({
        radarDistances: args.radarDistances,
        spotterLeft: args.spotterLeft,
        spotterRight: args.spotterRight,
        nearbyCars: [],
      } as unknown as ProximityFrame);
    },
    args: {
      radarDistances: {
        frontDist: 999,
        rearDist: 999,
        leftDist: null,
        rightDist: null,
      },
      spotterLeft: false,
      spotterRight: false,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const CarLeft: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.2,
      rightDist: null,
    },
    spotterLeft: true,
  },
};

export const CarRight: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: null,
      rightDist: 0.8,
    },
    spotterRight: true,
  },
};

export const BothSides: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.5,
      rightDist: 0.8,
    },
    spotterLeft: true,
    spotterRight: true,
  },
};

export const VeryClose: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 0.3,
      rightDist: null,
    },
    spotterLeft: true,
  },
};
