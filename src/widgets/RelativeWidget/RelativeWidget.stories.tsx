import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackSurface } from '@/types';
import type { DriverEntry, RelativeFrame } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import { driverEntries } from '@/storybook/test-data';
import { RelativeWidget } from './RelativeWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const BASE_ENTRIES: DriverEntry[] = driverEntries.map((entry, idx) => ({
  ...entry,
  carClassShortName: CLASS_LABELS[idx % CLASS_LABELS.length],
  onPitRoad: false,
  trackSurface: TrackSurface.OnTrack,
  pitState: 'none' as const,
  rawFlags: 0,
}));

const PLAYER_CAR_IDX =
  BASE_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const DEFAULT_SETTINGS: RelativeWidgetSettings = {
  showLicBadge: true,
  showIRating: true,
  showPitIndicator: true,
  abbreviateNames: false,
  showDriverFlags: true,
};

const BLUE_FLAG = 0x00000020;
const MEATBALL_FLAG = 0x00100000;
const PENALTY_FLAG = 0x00010000;

interface StoryArgs {
  settings: RelativeWidgetSettings;
}

const makeRelativeFrame = (entries: DriverEntry[]): RelativeFrame =>
  ({ entries, playerCarIdx: PLAYER_CAR_IDX }) as RelativeFrame;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RelativeWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
    seed: (store, args) => {
      store.backendComputed.updateRelative(makeRelativeFrame(BASE_ENTRIES));
      store.widgetSettings.updateUserSettings('relative', args.settings);
    },
    args: { settings: DEFAULT_SETTINGS },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const MinimalView: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showLicBadge: false,
      showIRating: false,
      showPitIndicator: false,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, abbreviateNames: true },
  },
};

export const WithPitBadges: Story = {
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
    seed: (store, args) => {
      const entries = BASE_ENTRIES.map((entry, idx) => {
        if (idx === 1) {
          return { ...entry, onPitRoad: true, pitState: 'in' as const };
        }

        if (idx === 3) {
          return {
            ...entry,
            trackSurface: TrackSurface.InPitStall,
            pitState: 'stall' as const,
          };
        }

        if (idx === 5) {
          return { ...entry, onPitRoad: true, pitState: 'exit' as const };
        }

        return entry;
      });

      store.backendComputed.updateRelative(makeRelativeFrame(entries));
      store.widgetSettings.updateUserSettings('relative', args.settings);
    },
    args: { settings: DEFAULT_SETTINGS },
  }),
};

export const WithDriverFlags: Story = {
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
    seed: (store, args) => {
      const entries = BASE_ENTRIES.map((entry, idx) => {
        if (idx === 1) return { ...entry, rawFlags: BLUE_FLAG };
        if (idx === 2) return { ...entry, rawFlags: MEATBALL_FLAG };
        if (idx === 4) return { ...entry, rawFlags: PENALTY_FLAG };

        return entry;
      });

      store.backendComputed.updateRelative(makeRelativeFrame(entries));
      store.widgetSettings.updateUserSettings('relative', args.settings);
    },
    args: { settings: DEFAULT_SETTINGS },
  }),
};
