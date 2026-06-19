import type { Meta, StoryObj } from '@storybook/react-vite';

import type { RelativeFrame } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import { driverEntries } from '@/storybook/test-data';
import { RelativeWidget } from './RelativeWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const DRIVER_ENTRIES = driverEntries.map((entry, idx) => ({
  ...entry,
  carClassShortName: CLASS_LABELS[idx % CLASS_LABELS.length],
}));

const PLAYER_CAR_IDX =
  DRIVER_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const DEFAULT_SETTINGS: RelativeWidgetSettings = {
  showLicBadge: true,
  showIRating: true,
  showPitIndicator: true,
  abbreviateNames: false,
  showDriverFlags: true,
};

interface StoryArgs {
  settings: RelativeWidgetSettings;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RelativeWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeWidget,
    size: { width: 406, height: 400 },
    seed: (store, args) => {
      store.backendComputed.updateRelative({
        entries: DRIVER_ENTRIES,
        playerCarIdx: PLAYER_CAR_IDX,
      } as RelativeFrame);

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

export const WithIRatingBadge: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showIRating: true },
  },
};

export const FullBadges: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showIRating: true },
  },
};
