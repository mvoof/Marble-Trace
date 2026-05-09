import type { Meta, StoryObj } from '@storybook/react-vite';

import { RadarBarWidget } from './RadarBarWidget';

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 380;

const DEFAULT_SETTINGS = {
  visibilityMode: 'always' as const,
  proximityThreshold: 3,
  hideDelay: 2,
  barDisplayMode: 'both' as const,
};

const meta: Meta<typeof RadarBarWidget> = {
  title: 'Widgets/RadarBarWidget',
  component: RadarBarWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: null,
      rightDist: null,
    },
    spotterLeft: false,
    spotterRight: false,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof RadarBarWidget>;

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

export const ActiveOnly: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.0,
      rightDist: null,
    },
    spotterLeft: true,
    spotterRight: false,
    settings: { ...DEFAULT_SETTINGS, barDisplayMode: 'active-only' },
  },
};
