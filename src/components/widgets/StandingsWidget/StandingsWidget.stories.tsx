import type { Meta, StoryObj } from '@storybook/react-vite';

import { StandingsWidget } from './StandingsWidget';
import {
  driverEntries as RAW_ENTRIES,
  snapshot,
} from '../../../storybook/test-data';
import type { SessionInfoData, WeekendInfo } from '../../../types/bindings';

const BASE_LAP_TIME = 92.3;
const LAP_TIME_SPREAD_PER_POS = 0.35;
const GAP_PER_POS = 1.8;

const DRIVER_ENTRIES = RAW_ENTRIES.map((e, i) => ({
  ...e,
  lap: 5,
  lastLapTime: BASE_LAP_TIME + i * LAP_TIME_SPREAD_PER_POS + (i % 3) * 0.12,
  bestLapTime: BASE_LAP_TIME + i * LAP_TIME_SPREAD_PER_POS * 0.8,
  f2Time: i === 0 ? 0 : i * GAP_PER_POS + (i % 4) * 0.3,
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

const meta: Meta<typeof StandingsWidget> = {
  title: 'Widgets/StandingsWidget',
  component: StandingsWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 800,
          height: 450,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
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
type Story = StoryObj<typeof StandingsWidget>;

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
