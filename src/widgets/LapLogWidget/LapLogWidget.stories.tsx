import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapTimingFrame, LapDeltaFrame } from '@/types/bindings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { RootStore } from '@store/root-store';
import type { LapHistoryEntry } from '@store/iracing/lap.store';
import {
  useTelemetryStore,
  useBackendComputedStore,
} from '@store/root-store-context';
import { LapLogWidget } from './LapLogWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

interface StoryArgs {
  liveDelta: number;
  currentLapTime: number;
  bestLapTime: number;
  lapNum: number;
}

const applyArgs = (
  stores: {
    telemetry: TelemetryStore;
    computed: BackendComputedStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.telemetry.updateLapTiming({
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

    stores.computed.updateLapDelta({
      sectorTimes: [],
      currentSectorIdx: 0,
      sectorDeltas: [],
    } as LapDeltaFrame);
  });
};

const seedHistory = (store: RootStore, entries: LapHistoryEntry[]) => {
  runInAction(() => {
    store.lap.history = entries;
  });
};

const StoryHost = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const computed = useBackendComputedStore();

  useLayoutEffect(() => {
    applyArgs({ telemetry, computed }, args);
  }, [args, telemetry, computed]);

  return <LapLogWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/LapLogWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-flex', minWidth: 220 }),
  ],
  args: {
    liveDelta: -0.312,
    currentLapTime: 42.18,
    bestLapTime: 88.107,
    lapNum: 9,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const Behind: Story = {
  args: { liveDelta: 0.845 },
};

export const NoHistory: Story = {
  args: { lapNum: 1, currentLapTime: 12.3, bestLapTime: 0 },
};

// Lap history: multiple laps including a best lap
export const WithHistory: Story = {
  decorators: [
    withStore((store) =>
      seedHistory(store, [
        { lapNum: 8, lapTime: 89.512, delta: 1.405, isBest: false },
        { lapNum: 7, lapTime: 88.107, delta: null, isBest: true },
        { lapNum: 6, lapTime: 90.331, delta: 2.224, isBest: false },
        { lapNum: 5, lapTime: 91.004, delta: 2.897, isBest: false },
        { lapNum: 4, lapTime: null, delta: null, isBest: false },
        { lapNum: 3, lapTime: 89.801, delta: 1.694, isBest: false },
      ])
    ),
    widgetDecorator({ display: 'inline-flex', minWidth: 220 }),
  ],
};

// Current lap is potentially a new best (negative delta)
export const PotentialBest: Story = {
  args: { liveDelta: -0.721, currentLapTime: 55.3, bestLapTime: 88.107 },
  decorators: [
    withStore((store) =>
      seedHistory(store, [
        { lapNum: 8, lapTime: 89.512, delta: 1.405, isBest: false },
        { lapNum: 7, lapTime: 88.107, delta: null, isBest: true },
        { lapNum: 6, lapTime: 90.331, delta: 2.224, isBest: false },
      ])
    ),
    widgetDecorator({ display: 'inline-flex', minWidth: 220 }),
  ],
};

// All laps are invalid (pit entries, resets)
export const AllInvalid: Story = {
  args: { lapNum: 5, currentLapTime: 18.4, bestLapTime: 0 },
  decorators: [
    withStore((store) =>
      seedHistory(store, [
        { lapNum: 4, lapTime: null, delta: null, isBest: false },
        { lapNum: 3, lapTime: null, delta: null, isBest: false },
        { lapNum: 2, lapTime: null, delta: null, isBest: false },
      ])
    ),
    widgetDecorator({ display: 'inline-flex', minWidth: 220 }),
  ],
};
