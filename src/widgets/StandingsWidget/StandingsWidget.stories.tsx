import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { DriverEntriesFrame } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import type { ComputedStore } from '@store/iracing/computed.store';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useComputedStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { driverEntries as RAW_ENTRIES, snapshot } from '@/storybook/test-data';
import { StandingsWidget } from './StandingsWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

const BASE_LAP_TIME = 92.3;
const LAP_TIME_SPREAD_PER_POS = 0.35;
const GAP_PER_POS = 1.8;

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const DRIVER_ENTRIES = RAW_ENTRIES.map((entry, idx) => ({
  ...entry,
  lap: 5,
  lastLapTime: BASE_LAP_TIME + idx * LAP_TIME_SPREAD_PER_POS + (idx % 3) * 0.12,
  bestLapTime: BASE_LAP_TIME + idx * LAP_TIME_SPREAD_PER_POS * 0.8,
  f2Time: idx === 0 ? 0 : idx * GAP_PER_POS + (idx % 4) * 0.3,
  carClassShortName: CLASS_LABELS[idx % CLASS_LABELS.length],
}));

const PLAYER_CAR_IDX =
  DRIVER_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const DEFAULT_SETTINGS: StandingsWidgetSettings = {
  enableClassCycling: false,
  classCyclingToggleHotkey: '',
  classPrevHotkey: '',
  classNextHotkey: '',
  showPosChange: true,
  showColumnHeaders: true,
  showSessionHeader: true,
  showWeather: true,
  showSOF: true,
  showTotalDrivers: true,
  showBrand: false,
  showTire: false,
  showIRatingBadge: false,
  showClassBadge: false,
  showIrChange: false,
  showPitStops: true,
  showLapsCompleted: false,
  showIncidentsBadge: true,
  abbreviateNames: false,
};

interface StoryArgs {
  settings: StandingsWidgetSettings;
  activeClassIndex: number;
}

const applyArgs = (
  stores: {
    computed: ComputedStore;
    telemetry: TelemetryStore;
    widgetSettings: WidgetSettingsStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.computed.updateStandings({
      entries: DRIVER_ENTRIES,
      playerCarIdx: PLAYER_CAR_IDX,
    } as DriverEntriesFrame);

    if (snapshot.sessionInfo) {
      stores.telemetry.updateSessionInfo(snapshot.sessionInfo);
    }

    stores.widgetSettings.updateUserSettings('standings', args.settings);
    stores.widgetSettings.standingsActiveClassIndex = args.activeClassIndex;
  });
};

const StoryHost = (args: StoryArgs) => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, telemetry, widgetSettings }, args);
  }, [args, computed, telemetry, widgetSettings]);

  return <StandingsWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/StandingsWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(seedFromSnapshot),
    widgetDecorator({ width: 800, height: 450 }),
  ],
  args: {
    settings: DEFAULT_SETTINGS,
    activeClassIndex: 0,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const ClassCycling: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, enableClassCycling: true },
    activeClassIndex: 0,
  },
};

export const MinimalColumns: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showPosChange: false,
      showColumnHeaders: false,
      showSessionHeader: false,
    },
  },
};

export const WithAllColumns: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showBrand: true,
      showTire: true,
      showIRatingBadge: true,
      showClassBadge: true,
      showIrChange: true,
      showLapsCompleted: true,
      showPosChange: true,
    },
  },
};

export const AbbreviatedNames: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, abbreviateNames: true },
  },
};

export const NoHeaders: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showColumnHeaders: false,
      showSessionHeader: false,
    },
  },
};

export const SecondClass: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, enableClassCycling: true },
    activeClassIndex: 1,
  },
};

export const ThirdClass: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, enableClassCycling: true },
    activeClassIndex: 2,
  },
};
