import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { DriverEntriesFrame } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import type { ComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { driverEntries } from '@/storybook/test-data';
import { RelativeWidget } from './RelativeWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const DRIVER_ENTRIES = driverEntries.map((entry, idx) => ({
  ...entry,
  carClassShortName: CLASS_LABELS[idx % CLASS_LABELS.length],
}));

const PLAYER_CAR_IDX =
  DRIVER_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const DEFAULT_SETTINGS: RelativeWidgetSettings = {
  showIRatingBadge: false,
  showClassBadge: false,
  showPitIndicator: true,
  showTrendIcon: true,
  abbreviateNames: false,
};

interface StoryArgs {
  settings: RelativeWidgetSettings;
}

const applyArgs = (
  stores: { computed: ComputedStore; widgetSettings: WidgetSettingsStore },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.computed.updateStandings({
      entries: DRIVER_ENTRIES,
      playerCarIdx: PLAYER_CAR_IDX,
    } as DriverEntriesFrame);

    stores.widgetSettings.updateUserSettings('relative', args.settings);
  });
};

const StoryHost = (args: StoryArgs) => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, widgetSettings }, args);
  }, [args, computed, widgetSettings]);

  return <RelativeWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/RelativeWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [withStore(), widgetDecorator({ width: 420, height: 400 })],
  args: { settings: DEFAULT_SETTINGS },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const MinimalView: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showIRatingBadge: false,
      showClassBadge: false,
      showPitIndicator: false,
      showTrendIcon: false,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, abbreviateNames: true },
  },
};

export const WithClassBadge: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showClassBadge: true },
  },
};

export const WithIRatingBadge: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showIRatingBadge: true },
  },
};

export const FullBadges: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showIRatingBadge: true,
      showClassBadge: true,
    },
  },
};
