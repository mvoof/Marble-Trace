import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RadarBarWidget } from './RadarBarWidget';

import {
  computeNearbyCars,
  computeRadarDistances,
  parseSpotterState,
} from '../../../storybook/proximity-utils';
import type { RadarSettings } from '../../../types/widget-settings';
import type { ComputedRadarDistances } from '../../../storybook/proximity-types';
import { CarLeftRight } from '../../../types/car-left-right';
import type { CarIdxFrame } from '../../../types/bindings';

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 380;
const CAR_SEARCH_RADIUS = 10.0;

const TRACK_LENGTH_M = 2351.1;
const PLAYER_PCT = 0.55881226;

const makeCarIdx = (
  carLeftRight: CarLeftRight,
  offsets: { idx: number; offsetM: number }[]
): CarIdxFrame => {
  const car_idx_lap_dist_pct = new Array<number>(64).fill(-1);
  const car_idx_on_pit_road = new Array<boolean>(64).fill(false);

  // Player
  car_idx_lap_dist_pct[0] = PLAYER_PCT;

  for (const { idx, offsetM } of offsets) {
    let pct = PLAYER_PCT + offsetM / TRACK_LENGTH_M;
    if (pct < 0) pct += 1;
    if (pct >= 1) pct -= 1;
    car_idx_lap_dist_pct[idx] = pct;
  }

  return {
    car_idx_lap_dist_pct,
    car_idx_on_pit_road,
  } as CarIdxFrame;
};

const meta: Meta<typeof RadarBarWidget> = {
  title: 'Widgets/RadarBarWidget',
  component: RadarBarWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', background: '#050505' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

interface RadarBarStoryArgs extends RadarSettings {
  carLeftRight: CarLeftRight;
  offsets: { idx: number; offsetM: number }[];
}

type Story = StoryObj<RadarBarStoryArgs>;

const RadarBarTemplate = (args: RadarBarStoryArgs) => {
  const { carLeftRight, offsets, ...settings } = args;

  const carIdx = useMemo(
    () => makeCarIdx(carLeftRight, offsets),
    [carLeftRight, offsets]
  );

  const nearbyCars = useMemo(
    () =>
      computeNearbyCars(
        carIdx,
        0,
        TRACK_LENGTH_M,
        CAR_SEARCH_RADIUS,
        carLeftRight
      ),
    [carIdx, carLeftRight]
  );

  const spotter = useMemo(
    () => parseSpotterState(carLeftRight),
    [carLeftRight]
  );
  const radarDistances = useMemo(
    (): ComputedRadarDistances => computeRadarDistances(nearbyCars, spotter),
    [nearbyCars, spotter]
  );

  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <RadarBarWidget
          radarDistances={radarDistances}
          spotterLeft={spotter.left}
          spotterRight={spotter.right}
          settings={settings}
        />
      </div>
    </div>
  );
};

export const Default: Story = {
  render: (args) => <RadarBarTemplate {...args} />,
  args: {
    visibilityMode: 'always',
    proximityThreshold: 3,
    hideDelay: 2,
    barDisplayMode: 'both',
    carLeftRight: CarLeftRight.Off,
    offsets: [
      { idx: 1, offsetM: 5.0 }, // Ahead
      { idx: 2, offsetM: -5.0 }, // Behind
    ],
  },
};

export const ThreeWide: Story = {
  render: (args) => <RadarBarTemplate {...args} />,
  args: {
    ...Default.args,
    carLeftRight: CarLeftRight.CarLeftRight,
    offsets: [
      { idx: 1, offsetM: 2.0 }, // Left side
      { idx: 2, offsetM: -1.0 }, // Right side
    ],
  },
};

export const Clearances: Story = {
  render: (args) => <RadarBarTemplate {...args} />,
  args: {
    ...Default.args,
    carLeftRight: CarLeftRight.CarLeft,
    offsets: [
      { idx: 1, offsetM: 0.5 }, // Overlapping left
      { idx: 2, offsetM: 8.0 }, // Ahead
    ],
  },
};

export const ActiveOnly: Story = {
  render: (args) => <RadarBarTemplate {...args} />,
  args: {
    ...Default.args,
    barDisplayMode: 'active-only',
    carLeftRight: CarLeftRight.CarLeft,
    offsets: [{ idx: 1, offsetM: 1.0 }],
  },
};

export const NoData: Story = {
  args: {
    visibilityMode: 'always',
    proximityThreshold: 3,
    hideDelay: 2,
    carLeftRight: CarLeftRight.Off,
    offsets: [],
  },
};
