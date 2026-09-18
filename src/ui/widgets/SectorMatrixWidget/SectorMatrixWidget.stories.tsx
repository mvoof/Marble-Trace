import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import { mockLapDelta, mockLapTiming } from '@store/preview/mocks/delta';
import { mockSectors } from '@store/preview/mocks/timing';
import { SectorMatrixWidget } from './SectorMatrixWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /** The live delta the header carries. */
  delta: number;
  lapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  lapDistPct: number;
  /** One entry per sector — `null` where the lap has not reached it yet. */
  sectorTimes: (number | null)[];
  sectorDeltas: (number | null)[];
  currentSectorIdx: number;
}

/** What a track is split into when a story states nothing else. */
const DEFAULT_SECTOR_COUNT = 3;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/SectorMatrixWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: SectorMatrixWidget,
    size: { width: 320 },
    seedSnapshot: true,
    seed: (store, args, scenarioId) => {
      const settings: Partial<SectorMatrixWidgetSettings> = {
        showPredicted: true,
      };

      store.liveWidgets.updateUserSettings('sector-matrix', settings);

      // A scenario states the whole lap — its timing and its sectors both. The
      // knobs below are the other base: what a story states on its own.
      if (scenarioId !== undefined) {
        return;
      }

      const sessionInfo = store.session.sessionInfo;

      if (sessionInfo) {
        store.session.updateSessionInfo({
          ...sessionInfo,
          sectors: mockSectors(args.sectorTimes.length || DEFAULT_SECTOR_COUNT),
        });
      }

      store.player.updateLapTiming(
        mockLapTiming({
          lap_dist_pct: args.lapDistPct,
          lap_current_lap_time: args.lapTime,
          lap_last_lap_time: args.lastLapTime,
          lap_best_lap_time: args.bestLapTime,
          lap_delta_to_session_best_live: args.delta,
          lap_delta_to_session_optimal_live: args.delta,
        })
      );

      store.backendComputed.updateLapDelta(
        mockLapDelta({
          sectorTimes: args.sectorTimes,
          sectorDeltas: args.sectorDeltas,
          currentSectorIdx: args.currentSectorIdx,
        })
      );
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

/** One sector banked, one being driven, one not reached — all three states at once. */
export const InProgress: Story = {
  parameters: previewScenario('sector-in-progress'),
};

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
