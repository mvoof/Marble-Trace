import type { Meta, StoryObj } from '@storybook/react-vite';

import type { NearbyCar, ProximityFrame } from '@/types/bindings';
import type {
  DuelBarWidgetSettings,
  DuelNameMode,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import { DUEL_BAR_MANIFEST } from './manifest';
import { DuelBarWidget } from './DuelBarWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  /** Signed longitudinal distances in meters: positive ahead, negative behind. */
  distances: number[];
  compactMode: boolean;
  nameMode: DuelNameMode;
  maxRows: number;
}

const EMPTY_RADAR = {
  frontDist: 999,
  rearDist: 999,
  leftDist: null,
  rightDist: null,
};

// The snapshot's own opponents, so names, numbers and class colors are real.
const buildNearbyCars = (
  store: RootStore,
  distances: number[]
): NearbyCar[] => {
  const opponents = store.backendComputed.relativeEntries.filter(
    (entry) => !entry.isPlayer
  );

  return distances.flatMap((longitudinalDist, index) => {
    const entry = opponents[index];

    if (!entry) {
      return [];
    }

    return [
      {
        carIdx: entry.carIdx,
        longitudinalDist,
        lateralSide: 'center',
        clearance: Math.abs(longitudinalDist),
      } as NearbyCar,
    ];
  });
};

const seed = (store: RootStore, args: StoryArgs) => {
  store.widgetSettings.updateUserSettings('duel-bar', {
    ...(DUEL_BAR_MANIFEST.userSettings as unknown as DuelBarWidgetSettings),
    trigger: 'distance',
    distanceThreshold: 200,
    maxRows: args.maxRows,
    raceOnly: false,
    compactMode: args.compactMode,
    nameMode: args.nameMode,
  });

  store.duelBarWidget.visible = true;

  store.backendComputed.updateProximity({
    radarDistances: EMPTY_RADAR,
    spotterLeft: false,
    spotterRight: false,
    nearbyCars: buildNearbyCars(store, args.distances),
  } as unknown as ProximityFrame);
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/DuelBarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: DuelBarWidget,
    size: { width: 440, height: 420, background: '#0e0f12' },
    seedSnapshot: true,
    seed,
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
