import type { Meta, StoryObj } from '@storybook/react-vite';

import { StandingsList } from './StandingsList/StandingsList';
import {
  driverEntries as RAW_ENTRIES,
  snapshot,
} from '../../../storybook/test-data';
import { widgetDecorator } from '../../../stories/widgetDecorator';
import type { SessionInfoData, WeekendInfo } from '../../../types/bindings';

const BASE_LAP_TIME = 92.3;
const LAP_TIME_SPREAD_PER_POS = 0.35;
const GAP_PER_POS = 1.8;

const CLASS_LABELS = ['GTE', 'GT3', 'LMP2'];

const DRIVER_ENTRIES = RAW_ENTRIES.map((e, i) => ({
  ...e,
  lap: 5,
  lastLapTime: BASE_LAP_TIME + i * LAP_TIME_SPREAD_PER_POS + (i % 3) * 0.12,
  bestLapTime: BASE_LAP_TIME + i * LAP_TIME_SPREAD_PER_POS * 0.8,
  f2Time: i === 0 ? 0 : i * GAP_PER_POS + (i % 4) * 0.3,
  carClassShortName: CLASS_LABELS[i % CLASS_LABELS.length],
}));

const DEFAULT_SETTINGS = {
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

const meta: Meta<typeof StandingsList> = {
  title: 'Widgets/StandingsWidget',
  component: StandingsList,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 800, height: 450 })],
  args: {
    driverEntries: DRIVER_ENTRIES,
    settings: DEFAULT_SETTINGS,
    irDeltaMap: new Map(),
    effectiveStartPosMap: new Map(),
    playerPitStops: 1,
    playerIncidents: 2,
    sessionInfo: snapshot.sessionInfo as unknown as SessionInfoData,
    weekendInfo: snapshot.sessionInfo?.WeekendInfo as unknown as WeekendInfo,
    overallSof: 2800,
    activeClassIndex: 0,
    dragMode: false,
    onPrevClass: () => {},
    onNextClass: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof StandingsList>;

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
