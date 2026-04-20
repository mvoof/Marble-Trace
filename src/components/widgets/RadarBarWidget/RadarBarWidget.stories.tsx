import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RadarBarWidget } from './RadarBarWidget';
import { WidgetScaler } from '../../WidgetScaler';
import {
  computeNearbyCars,
  computeRadarDistances,
  parseTrackLength,
  parseSpotterState,
} from '../../../utils/proximity';
import type { RadarSettings } from '../../../store/widget-settings.store';
import { CarLeftRight } from '../../../types/car-left-right';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import type { CarIdxFrame } from '../../../types/bindings';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 380;
const CAR_SEARCH_RADIUS = 10.0;

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
const carIdxCarLeft = makeCarIdx(CarLeftRight.CarLeft, [
  { idx: 1, offsetM: 1 },
]);
const carIdxCarRight = makeCarIdx(CarLeftRight.CarRight, [
  { idx: 1, offsetM: -1 },
]);
const carIdxBothSides = makeCarIdx(CarLeftRight.CarLeftRight, [
  { idx: 1, offsetM: 1 },
  { idx: 4, offsetM: -1 },
]);
const carIdxCarLeftAhead = makeCarIdx(CarLeftRight.CarLeft, [
  { idx: 1, offsetM: 3 },
]);
const carIdxCarRightBehind = makeCarIdx(CarLeftRight.CarRight, [
  { idx: 1, offsetM: -3 },
]);

const DEFAULT_SETTINGS: RadarSettings = {
  visibilityMode: 'always',
  barDisplayMode: 'both',
  proximityThreshold: 3,
  hideDelay: 2,
  barSpacing: 0,
};

interface RadarBarStoryArgs extends RadarSettings {
  snapshot: TelemetrySnapshot;
}

const RadarBarWidgetStory = ({
  snapshot: snap,
  ...settings
}: RadarBarStoryArgs) => {
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
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="transparent"
      >
        <RadarBarWidget
          radarDistances={radarDistances}
          spotter={spotter}
          settings={settings}
        />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<RadarBarStoryArgs> = {
  title: 'Widgets/RadarBarWidget',
  component: RadarBarWidgetStory,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1a2e' }],
    },
  },
  args: {
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<RadarBarStoryArgs>;

export const Clear: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxClear } },
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

export const CarLeftAhead: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxCarLeftAhead } },
};

export const CarRightBehind: Story = {
  args: { snapshot: { ...realSnapshot, carIdx: carIdxCarRightBehind } },
};

export const ActiveOnly: Story = {
  args: {
    barDisplayMode: 'active-only',
    snapshot: { ...realSnapshot, carIdx: carIdxCarRight },
  },
};

export const ProximityMode: Story = {
  args: {
    visibilityMode: 'proximity',
    snapshot: { ...realSnapshot, carIdx: carIdxCarLeft },
  },
};

export const WideSpacing: Story = {
  args: {
    barSpacing: 200,
    snapshot: { ...realSnapshot, carIdx: carIdxCarLeft },
  },
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
