import type { Meta, StoryObj } from '@storybook/react-vite';

import type { DriverEntriesFrame } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { driverEntries as RAW_ENTRIES, snapshot } from '@/storybook/test-data';
import { StandingsWidget } from './StandingsWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

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
  resultsPositionLap: idx > 6 ? 1 : 0,
  resultsPositionTime: idx === 0 ? 0 : idx * GAP_PER_POS + (idx % 4) * 0.3,
}));

const PLAYER_CAR_IDX =
  DRIVER_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const DEFAULT_SETTINGS: StandingsWidgetSettings = {
  viewMode: 'all',
  viewModeHotkey: '',
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
  showLicBadge: false,
  showIRating: false,
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

const meta: Meta<StoryArgs> = {
  title: 'Widgets/StandingsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: StandingsWidget,
    size: { width: 796, height: 500 },
    seedSnapshot: true,
    seed: (store, args) => {
      store.backendComputed.updateStandings({
        entries: DRIVER_ENTRIES,
        playerCarIdx: PLAYER_CAR_IDX,
      } as DriverEntriesFrame);

      if (snapshot.sessionInfo) {
        store.telemetry.updateSessionInfo(snapshot.sessionInfo);
      }

      store.widgetSettings.updateUserSettings('standings', args.settings);
      store.widgetSettings.standingsActiveClassIndex = args.activeClassIndex;
    },
    args: {
      settings: DEFAULT_SETTINGS,
      activeClassIndex: 0,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const ClassCycling: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, viewMode: 'cycling' },
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
      showLicBadge: true,
      showIRating: true,
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
    settings: { ...DEFAULT_SETTINGS, viewMode: 'cycling' },
    activeClassIndex: 1,
  },
};

export const ThirdClass: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, viewMode: 'cycling' },
    activeClassIndex: 2,
  },
};
