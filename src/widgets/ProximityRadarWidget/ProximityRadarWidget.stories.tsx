import type { Meta, StoryObj } from '@storybook/react-vite';

import { RadarDisplay } from './RadarDisplay/RadarDisplay';
import { widgetDecorator } from '../../storybook/widgetDecorator';

const DESIGN_WIDTH = 200;
const DESIGN_HEIGHT = 300;

const meta: Meta<typeof RadarDisplay> = {
  title: 'Widgets/ProximityRadarWidget',
  component: RadarDisplay,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT })],
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: null,
      rightDist: null,
    },
    spotterLeft: false,
    spotterRight: false,
    formatDistance: (m: number) => m.toFixed(1),
    distanceUnit: 'm',
  },
};

export default meta;
type Story = StoryObj<typeof RadarDisplay>;

export const NoCars: Story = {};

export const CarLeft: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.2,
      rightDist: null,
    },
    spotterLeft: true,
    spotterRight: false,
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
    spotterLeft: false,
    spotterRight: true,
  },
};

export const CarsBothSides: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.5,
      rightDist: 1.0,
    },
    spotterLeft: true,
    spotterRight: true,
  },
};

export const CarAhead: Story = {
  args: {
    radarDistances: {
      frontDist: 4.0,
      rearDist: 999,
      leftDist: null,
      rightDist: null,
    },
    spotterLeft: false,
    spotterRight: false,
  },
};

export const CarBehind: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 3.5,
      leftDist: null,
      rightDist: null,
    },
    spotterLeft: false,
    spotterRight: false,
  },
};

export const Surrounded: Story = {
  args: {
    radarDistances: {
      frontDist: 3.0,
      rearDist: 2.5,
      leftDist: 1.2,
      rightDist: 1.0,
    },
    spotterLeft: true,
    spotterRight: true,
  },
};
