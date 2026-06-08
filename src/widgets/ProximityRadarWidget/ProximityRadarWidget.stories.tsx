import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ProximityFrame } from '@/types/bindings';
import { ProximityRadarWidget } from './ProximityRadarWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const NO_CARS: ProximityFrame = {
  nearbyCars: [],
  radarDistances: {
    frontDist: 999,
    rearDist: 999,
    leftDist: null,
    rightDist: null,
  },
  spotterLeft: false,
  spotterRight: false,
};

interface StoryArgs {
  proximity: ProximityFrame;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/ProximityRadarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: ProximityRadarWidget,
    size: { width: 200, height: 300 },
    seed: (store, args) => {
      store.backendComputed.updateProximity(args.proximity);
    },
    args: { proximity: NO_CARS },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const NoCars: Story = {};

export const CarLeft: Story = {
  args: {
    proximity: {
      nearbyCars: [
        { carIdx: 1, longitudinalDist: 0, lateralSide: 'left', clearance: 0 },
      ],
      radarDistances: {
        frontDist: 999,
        rearDist: 999,
        leftDist: 1.2,
        rightDist: null,
      },
      spotterLeft: true,
      spotterRight: false,
    },
  },
};

export const CarRight: Story = {
  args: {
    proximity: {
      nearbyCars: [
        { carIdx: 2, longitudinalDist: 0, lateralSide: 'right', clearance: 0 },
      ],
      radarDistances: {
        frontDist: 999,
        rearDist: 999,
        leftDist: null,
        rightDist: 0.8,
      },
      spotterLeft: false,
      spotterRight: true,
    },
  },
};

export const CarsBothSides: Story = {
  args: {
    proximity: {
      nearbyCars: [
        { carIdx: 1, longitudinalDist: 0, lateralSide: 'left', clearance: 0 },
        { carIdx: 2, longitudinalDist: 0, lateralSide: 'right', clearance: 0 },
      ],
      radarDistances: {
        frontDist: 999,
        rearDist: 999,
        leftDist: 1.5,
        rightDist: 1.0,
      },
      spotterLeft: true,
      spotterRight: true,
    },
  },
};

export const CarAhead: Story = {
  args: {
    proximity: {
      nearbyCars: [
        {
          carIdx: 3,
          longitudinalDist: 4.0,
          lateralSide: 'center',
          clearance: 4.0,
        },
      ],
      radarDistances: {
        frontDist: 4.0,
        rearDist: 999,
        leftDist: null,
        rightDist: null,
      },
      spotterLeft: false,
      spotterRight: false,
    },
  },
};

export const CarBehind: Story = {
  args: {
    proximity: {
      nearbyCars: [
        {
          carIdx: 4,
          longitudinalDist: -3.5,
          lateralSide: 'center',
          clearance: 3.5,
        },
      ],
      radarDistances: {
        frontDist: 999,
        rearDist: 3.5,
        leftDist: null,
        rightDist: null,
      },
      spotterLeft: false,
      spotterRight: false,
    },
  },
};

export const Surrounded: Story = {
  args: {
    proximity: {
      nearbyCars: [
        {
          carIdx: 1,
          longitudinalDist: 3.0,
          lateralSide: 'left',
          clearance: 3.0,
        },
        {
          carIdx: 2,
          longitudinalDist: -2.5,
          lateralSide: 'right',
          clearance: 2.5,
        },
        { carIdx: 3, longitudinalDist: 0, lateralSide: 'left', clearance: 1.2 },
        {
          carIdx: 4,
          longitudinalDist: 0,
          lateralSide: 'right',
          clearance: 1.0,
        },
      ],
      radarDistances: {
        frontDist: 3.0,
        rearDist: 2.5,
        leftDist: 1.2,
        rightDist: 1.0,
      },
      spotterLeft: true,
      spotterRight: true,
    },
  },
};
