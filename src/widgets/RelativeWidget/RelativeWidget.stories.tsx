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
const PLAYER_IDX = BASE_ENTRIES.findIndex((entry) => entry.isPlayer);

const BLUE_FLAG = 0x00000020;
const MEATBALL_FLAG = 0x00100000;
const PENALTY_FLAG = 0x00010000;

const withOverrides = (
  overrides: Record<number, Partial<DriverEntry>>
): DriverEntry[] =>
  BASE_ENTRIES.map((entry, idx) => {
    const offset = idx - PLAYER_IDX;
    const override = overrides[offset];

    return override ? { ...entry, ...override } : entry;
  });

const PIT_ENTRIES = withOverrides({
  [-2]: { onPitRoad: true, pitState: 'in' as const },
  [-1]: { trackSurface: TrackSurface.InPitStall, pitState: 'stall' as const },
  [2]: { onPitRoad: true, pitState: 'exit' as const },
});

const FLAG_ENTRIES = withOverrides({
  [-3]: { rawFlags: BLUE_FLAG },
  [-1]: { rawFlags: MEATBALL_FLAG },
  [1]: { rawFlags: PENALTY_FLAG },
});

const DEFAULT_SETTINGS: RelativeWidgetSettings = {
  showLicBadge: true,
  showIRating: true,
  showPitIndicator: true,
  abbreviateNames: false,
  showDriverFlags: true,
};

interface StoryArgs {
  settings: RelativeWidgetSettings;
  entries: DriverEntry[];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RelativeWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
    seed: (store, args) => {
      store.backendComputed.updateRelative({
        entries: args.entries,
        playerCarIdx: PLAYER_CAR_IDX,
      } as RelativeFrame);
      store.widgetSettings.updateUserSettings('relative', args.settings);
    },
    args: { settings: DEFAULT_SETTINGS, entries: BASE_ENTRIES },
    argTypes: {
      entries: { table: { disable: true } },
    },
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
  args: { entries: PIT_ENTRIES },
};

export const WithDriverFlags: Story = {
  args: { entries: FLAG_ENTRIES },
};
