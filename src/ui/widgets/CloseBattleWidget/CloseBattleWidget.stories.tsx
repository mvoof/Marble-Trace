import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  BattleNameMode,
  CloseBattleWidgetSettings,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import { mockProximity } from '@store/preview/mocks/traffic';
import { CloseBattleWidget } from './CloseBattleWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /**
   * Signed distances in metres, positive ahead of the player — one per car in
   * the fight. Left undefined, which is what a story naming a scenario does,
   * the scenario's own traffic is kept.
   */
  distances?: number[];
  compactMode: boolean;
  nameMode: BattleNameMode;
  maxRows: number;
}

/** Far enough that the trigger takes in the whole axis the stories draw. */
const DISTANCE_THRESHOLD_M = 200;

// The snapshot's own opponents, so names, numbers and class colors are real —
// the widget looks every car up by its index. The frame itself is the traffic
// builder's, so the radar distances and the spotter flags agree with the cars.
const seedTraffic = (store: RootStore, distances: number[]) => {
  const opponents = store.backendComputed.relativeEntries.filter(
    (entry) => !entry.isPlayer
  );

  store.backendComputed.updateProximity(
    mockProximity(
      distances.flatMap((longitudinalDist, index) => {
        const entry = opponents[index];

        if (!entry) {
          return [];
        }

        return [
          { carIdx: entry.carIdx, longitudinalDist, side: 'center' as const },
        ];
      })
    )
  );
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/CloseBattleWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: CloseBattleWidget,
    size: { width: 440, height: 420, background: '#0e0f12' },
    seedSnapshot: true,
    seed: (store, args) => {
      const settings: Partial<CloseBattleWidgetSettings> = {
        // The widget is normally armed by a gap and only during a race; the
        // stories state the cars themselves, so both gates are opened.
        trigger: 'distance',
        distanceThreshold: DISTANCE_THRESHOLD_M,
        raceOnly: false,
        maxRows: args.maxRows,
        compactMode: args.compactMode,
        nameMode: args.nameMode,
      };

      store.liveWidgets.updateUserSettings('close-battle', settings);
      store.closeBattleWidget.visible = true;

      if (args.distances !== undefined) {
        seedTraffic(store, args.distances);
      }
    },
    args: {
      distances: [-8],
      compactMode: false,
      nameMode: 'initial',
      maxRows: 3,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const OneBehind: Story = {};

export const OneAhead: Story = {
  args: { distances: [45] },
};

export const ThreeInTheFight: Story = {
  args: { distances: [-8, 45, 85] },
};

/** One ahead, one behind and a merged pair — every shape, in one frame. */
export const AheadBehindAndMerged: Story = {
  parameters: previewScenario('close-battle'),
  args: { distances: undefined, maxRows: 4 },
};

export const FullNames: Story = {
  args: { distances: [-8, 45], nameMode: 'full' },
};

export const SurnamesOnly: Story = {
  args: { distances: [-8, 45], nameMode: 'surname' },
};

export const CompactAxisOnly: Story = {
  args: { distances: [-8, 45, 85], compactMode: true },
};

/** Two cars on the same spot of the axis: one plate that names both of them. */
export const MergedIntoOnePlate: Story = {
  args: { distances: [-7, -8, 60] },
};

/**
 * Four cars in one spot — two surnames fit, the rest become a count. The plate
 * keeps its height and its layout; only the names it can afford change.
 */
export const MergedCrowd: Story = {
  args: { distances: [-6, -7, -8, -9], maxRows: 4 },
};
