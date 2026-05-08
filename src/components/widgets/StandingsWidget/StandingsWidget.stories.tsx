import type { Meta, StoryObj } from '@storybook/react-vite';

import { StandingsWidget } from './StandingsWidget';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshotRaw from '../../../../test-data/iracing-1776008424511.json';

const snapshot = snapshotRaw as unknown as TelemetrySnapshot;
const DRIVER_ENTRIES = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo?.DriverInfo ?? null
);

const DEFAULT_SETTINGS = {
  enableClassCycling: false,
  classCyclingToggleHotkey: '',
  classPrevHotkey: '',
  classNextHotkey: '',
  showPosChange: true,
  showColumnHeaders: true,
  showSessionHeader: true,
  showWeather: false,
  showSOF: true,
  showTotalDrivers: true,
  showBrand: false,
  showTire: false,
  showIRatingBadge: false,
  showClassBadge: false,
  showIrChange: false,
  showPitStops: false,
  showLapsCompleted: false,
  showIncidentsBadge: false,
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
          width: 640,
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
    sessionInfo: null,
    weekendInfo: null,
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
