import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  LapTimingFrame,
  LapDeltaFrame,
  SessionSnapshot,
} from '@/types/bindings';
import { SectorMatrixWidget } from './SectorMatrixWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  delta: number;
  lapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  lapDistPct: number;
  sectorTimes: (number | null)[];
  sectorDeltas: (number | null)[];
  currentSectorIdx: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/SectorMatrixWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: SectorMatrixWidget,
    size: { width: 320 },
    seed: (store, args) => {
      const sectorCount = args.sectorTimes.length || 3;

      store.player.updateLapTiming({
        lap: 3,
        lap_dist: null,
        lap_dist_pct: args.lapDistPct,
        lap_current_lap_time: args.lapTime,
        lap_last_lap_time: args.lastLapTime,
        lap_best_lap_time: args.bestLapTime,
        player_car_position: 1,
        player_car_class_position: 1,
        lap_delta_to_session_best_live: args.delta,
        lap_delta_to_session_optimal_live: args.delta,
      } as LapTimingFrame);

      store.session.updateSessionInfo({
        sectors: Array.from({ length: sectorCount }, (_, idx) => ({
          sectorNum: idx,
          sectorStartPct: idx / sectorCount,
        })),
      } as unknown as SessionSnapshot);

      store.backendComputed.updateLapDelta({
        sectorTimes: args.sectorTimes,
        currentSectorIdx: args.currentSectorIdx,
        sectorDeltas: args.sectorDeltas,
      } as LapDeltaFrame);

      store.widgetSettings.updateUserSettings('sector-matrix', {
        reference: 'personal_best',
        showPredicted: true,
      });
    },
    args: {
      delta: -0.412,
      lapTime: 68.732,
      lastLapTime: 109.01,
      bestLapTime: 108.733,
      lapDistPct: 0.42,
      sectorTimes: [22.1, 31.4, null],
      sectorDeltas: [-0.12, 0.08, null],
      currentSectorIdx: 2,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Behind: Story = {
  args: { delta: 0.612, sectorDeltas: [0.21, 0.15, null] },
};

export const ManySectors: Story = {
  args: {
    delta: -0.215,
    sectorTimes: [
      8.1,
      7.9,
      8.3,
      7.8,
      8.5,
      7.6,
      8.2,
      8.0,
      null,
      null,
      null,
      null,
    ],
    sectorDeltas: [
      -0.05,
      0.03,
      -0.08,
      0.01,
      -0.12,
      0.04,
      -0.06,
      0.02,
      null,
      null,
      null,
      null,
    ],
    currentSectorIdx: 8,
  },
};

export const NoData: Story = {
  args: {
    delta: 0,
    lapTime: 0,
    lastLapTime: 0,
    bestLapTime: 0,
    lapDistPct: 0,
    sectorTimes: [],
    sectorDeltas: [],
    currentSectorIdx: 0,
  },
};
