import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProximityRadarWidget } from './ProximityRadarWidget';
import { WidgetScaler } from '../../WidgetScaler';
import {
  computeNearbyCars,
  computeRadarDistances,
  parseTrackLength,
  parseSpotterState,
} from '../../../utils/proximity';
import { CarLeftRight } from '../../../types/car-left-right';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import type { CarIdxFrame } from '../../../types/bindings';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 300;
const DESIGN_HEIGHT = 300;
const CAR_SEARCH_RADIUS = 30;

const realSnapshot = snapshot as TelemetrySnapshot;

const TRACK_LENGTH_M = 2351.1;
const PLAYER_PCT = 0.55881226;

const makeCarIdx = (
  carLeftRight: CarLeftRight,
  offsets: { idx: number; offsetM: number }[]
): CarIdxFrame => {
  const base = realSnapshot.carIdx!;
  const pcts = [...base.car_idx_lap_dist_pct];
  const onPit = [...base.car_idx_on_pit_road];

  for (const { idx, offsetM } of offsets) {
    pcts[idx] = PLAYER_PCT + offsetM / TRACK_LENGTH_M;
    onPit[idx] = false;
  }

  return {
    ...base,
    car_idx_lap_dist_pct: pcts,
    car_idx_on_pit_road: onPit,
    car_left_right: carLeftRight,
  };
};

const carIdxClear = makeCarIdx(CarLeftRight.Clear, []);
const carIdxCarAhead = makeCarIdx(CarLeftRight.Clear, [{ idx: 1, offsetM: 6 }]);
const carIdxCarBehind = makeCarIdx(CarLeftRight.Clear, [
  { idx: 1, offsetM: -5 },
]);
const carIdxFrontAndRear = makeCarIdx(CarLeftRight.Clear, [
  { idx: 1, offsetM: 7 },
  { idx: 4, offsetM: -4 },
]);
const carIdxCarLeft = makeCarIdx(CarLeftRight.CarLeft, [
  { idx: 1, offsetM: 0.5 },
]);
const carIdxCarRight = makeCarIdx(CarLeftRight.CarRight, [
  { idx: 1, offsetM: -0.5 },
]);
const carIdxBothSides = makeCarIdx(CarLeftRight.CarLeftRight, [
  { idx: 1, offsetM: 0.5 },
  { idx: 4, offsetM: -0.5 },
]);
const carIdxSideAndFront = makeCarIdx(CarLeftRight.CarLeft, [
  { idx: 1, offsetM: 0.5 },
  { idx: 4, offsetM: 8 },
]);

interface ProximityRadarStoryArgs {
  snapshot: TelemetrySnapshot;
  containerWidth: number;
  containerHeight: number;
}

const ProximityRadarWidgetStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
}: ProximityRadarStoryArgs) => {
  const carIdx = snap.carIdx;
  const playerCarIdx = snap.sessionInfo?.DriverInfo?.DriverCarIdx ?? null;
  const trackLength = useMemo(
    () => parseTrackLength(snap.sessionInfo?.WeekendInfo?.TrackLength ?? ''),
    [snap.sessionInfo?.WeekendInfo?.TrackLength]
  );
  const carLeftRight = carIdx?.car_left_right ?? 0;

  const nearbyCars = useMemo(() => {
    if (!carIdx || playerCarIdx === null || trackLength <= 0) return [];
    return computeNearbyCars(
      carIdx,
      playerCarIdx,
      trackLength,
      CAR_SEARCH_RADIUS,
      carLeftRight
    );
  }, [carIdx, playerCarIdx, trackLength, carLeftRight]);

  const spotter = useMemo(
    () => parseSpotterState(carLeftRight),
    [carLeftRight]
  );
  const radarDistances = useMemo(
    () => computeRadarDistances(nearbyCars, spotter),
    [nearbyCars, spotter]
  );

  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="transparent"
      >
        <ProximityRadarWidget
          radarDistances={radarDistances}
          spotter={spotter}
        />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<ProximityRadarStoryArgs> = {
  title: 'Widgets/ProximityRadarWidget',
  component: ProximityRadarWidgetStory,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1a2e' }],
    },
  },
  argTypes: {
    containerWidth: {
      control: { type: 'range', min: 100, max: 600, step: 10 },
      description: 'Container width (px)',
      table: { category: 'Container' },
    },
    containerHeight: {
      control: { type: 'range', min: 100, max: 600, step: 10 },
      description: 'Container height (px)',
      table: { category: 'Container' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    containerWidth: DESIGN_WIDTH,
    containerHeight: DESIGN_HEIGHT,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<ProximityRadarStoryArgs>;

export const Clear: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxClear } },
};

export const CarAhead: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxCarAhead } },
};

export const CarBehind: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxCarBehind } },
};

export const Sandwiched: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxFrontAndRear } },
};

export const CarOnLeft: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxCarLeft } },
};

export const CarOnRight: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxCarRight } },
};

export const ThreeWide: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxBothSides } },
};

export const SideAndFront: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxSideAndFront } },
};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carDynamics: null,
      carIdx: null,
      carInputs: null,
      carStatus: null,
      environment: null,
      lapTiming: null,
      session: null,
      sessionInfo: null,
    },
  },
};
