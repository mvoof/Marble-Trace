import type { Meta, StoryObj } from '@storybook/react-vite';

import type { LapHistoryEntry } from '@/types/bindings';
import {
  mockLapDelta,
  mockLapLog,
  mockLapTiming,
} from '@store/preview/mocks/delta';
import { whenSet } from '@/storybook/story-overrides';
import { LapLogWidget } from './LapLogWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /** The live delta the top row draws. */
  liveDelta?: number;
  currentLapTime?: number;
  bestLapTime?: number;
  lapNum?: number;
  /**
   * The laps behind the current one. Left undefined — which is what a story
   * naming a scenario does — the base's own history is kept.
   */
  history?: LapHistoryEntry[];
}

/** Three laps in a row with no time on any of them — an out-lap and two spins. */
const INVALID_LAPS: LapHistoryEntry[] = [
  { lapNum: 4, lapTime: null, delta: null, isBest: false },
  { lapNum: 3, lapTime: null, delta: null, isBest: false },
  { lapNum: 2, lapTime: null, delta: null, isBest: false },
];

const meta: Meta<StoryArgs> = {
  title: 'Widgets/LapLogWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: LapLogWidget,
    size: { width: 220, height: 260 },
    seed: (store, args, scenarioId) => {
      // A scenario states the whole lap — its timing, its delta and its log.
      // The knobs below are the other base: what a story states when no
      // scenario is named.
      if (scenarioId !== undefined) {
        return;
      }

      store.player.updateLapTiming(
        mockLapTiming({
          ...whenSet(args.lapNum, (lap) => ({ lap })),
          ...whenSet(args.currentLapTime, (time) => ({
            lap_current_lap_time: time,
          })),
          ...whenSet(args.bestLapTime, (time) => ({ lap_best_lap_time: time })),
          ...whenSet(args.liveDelta, (delta) => ({
            lap_delta_to_session_best_live: delta,
            lap_delta_to_session_optimal_live: delta,
          })),
        })
      );

      // The log draws no sectors of its own, but the delta frame is what the
      // store holds the lap in — a widget reading an empty one shows dashes.
      store.backendComputed.updateLapDelta(mockLapDelta());

      if (args.history !== undefined) {
        store.backendComputed.updateLapLog(
          mockLapLog({ history: args.history })
        );
      }
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** Mid-lap, a couple of tenths up, with the log still empty. */
export const Default: Story = {
  args: {
    liveDelta: -0.312,
    currentLapTime: 42.18,
    bestLapTime: 88.107,
    lapNum: 9,
    history: [],
  },
};

export const Behind: Story = {
  args: { ...Default.args, liveDelta: 0.845 },
};

export const NoHistory: Story = {
  args: { ...Default.args, lapNum: 1, currentLapTime: 12.3, bestLapTime: 0 },
};

export const WithHistory: Story = {
  args: { ...Default.args, history: mockLapLog().history },
};

/** The lap that has just gone green — the star row and the re-deltaed laps under it. */
export const PersonalBest: Story = {
  parameters: previewScenario('delta-personal-best'),
};

export const PotentialBest: Story = {
  args: {
    ...Default.args,
    liveDelta: -0.721,
    currentLapTime: 55.3,
    bestLapTime: 88.107,
    history: mockLapLog().history.slice(0, 3),
  },
};

export const AllInvalid: Story = {
  args: {
    ...Default.args,
    lapNum: 5,
    currentLapTime: 18.4,
    bestLapTime: 0,
    history: INVALID_LAPS,
  },
};
