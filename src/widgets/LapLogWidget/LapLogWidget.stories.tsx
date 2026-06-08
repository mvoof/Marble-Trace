import type { Meta, StoryObj } from '@storybook/react-vite';

import type { LapTimingFrame, LapDeltaFrame } from '@/types/bindings';
import type { LapHistoryEntry } from '@store/iracing/lap.store';
import { LapLogWidget } from './LapLogWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  liveDelta: number;
  currentLapTime: number;
  bestLapTime: number;
  lapNum: number;
  history: LapHistoryEntry[];
}

const HISTORY: LapHistoryEntry[] = [
  { lapNum: 8, lapTime: 89.512, delta: 1.405, isBest: false },
  { lapNum: 7, lapTime: 88.107, delta: null, isBest: true },
  { lapNum: 6, lapTime: 90.331, delta: 2.224, isBest: false },
  { lapNum: 5, lapTime: 91.004, delta: 2.897, isBest: false },
  { lapNum: 4, lapTime: null, delta: null, isBest: false },
  { lapNum: 3, lapTime: 89.801, delta: 1.694, isBest: false },
];

const meta: Meta<StoryArgs> = {
  title: 'Widgets/LapLogWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: LapLogWidget,
    size: { width: 220, height: 260 },
    seed: (store, args) => {
      store.telemetry.updateLapTiming({
        lap: args.lapNum,
        lap_dist: null,
        lap_dist_pct: 0.42,
        lap_current_lap_time: args.currentLapTime,
        lap_last_lap_time: 89.512,
        lap_best_lap_time: args.bestLapTime,
        player_car_position: 3,
        player_car_class_position: 3,
        lap_delta_to_session_best_live: args.liveDelta,
        lap_delta_to_session_optimal_live: args.liveDelta,
      } as LapTimingFrame);

      store.backendComputed.updateLapDelta({
        sectorTimes: [],
        currentSectorIdx: 0,
        sectorDeltas: [],
      } as LapDeltaFrame);

      store.lap.history = args.history;
    },
    args: {
      liveDelta: -0.312,
      currentLapTime: 42.18,
      bestLapTime: 88.107,
      lapNum: 9,
      history: [],
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Behind: Story = {
  args: { liveDelta: 0.845 },
};

export const NoHistory: Story = {
  args: { lapNum: 1, currentLapTime: 12.3, bestLapTime: 0 },
};

export const WithHistory: Story = {
  args: { history: HISTORY },
};

export const PotentialBest: Story = {
  args: {
    liveDelta: -0.721,
    currentLapTime: 55.3,
    bestLapTime: 88.107,
    history: HISTORY.slice(0, 3),
  },
};

export const AllInvalid: Story = {
  args: {
    lapNum: 5,
    currentLapTime: 18.4,
    bestLapTime: 0,
    history: [
      { lapNum: 4, lapTime: null, delta: null, isBest: false },
      { lapNum: 3, lapTime: null, delta: null, isBest: false },
      { lapNum: 2, lapTime: null, delta: null, isBest: false },
    ],
  },
};
