import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackMapWidget } from './TrackMapWidget';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshotRaw from '../../../../test-data/iracing-1776008424511.json';
import tracksRaw from '../../../../test-data/tracks.json';

const snapshot = snapshotRaw as unknown as TelemetrySnapshot;
const DRIVER_ENTRIES = computeDriverEntries(
  snapshot.carIdx,
  snapshot.sessionInfo?.DriverInfo ?? null
);

const tracksData = tracksRaw as Record<
  string,
  Record<
    string,
    {
      svgPath: string;
      viewBox: string;
      points: { x: number; y: number; pct: number }[];
      trackName: string;
    }
  >
>;
const STORED_TRACK = Object.values(tracksData['recorded-tracks'])[0];

const TRACK_DATA = {
  svgPath: STORED_TRACK.svgPath,
  viewBox: STORED_TRACK.viewBox,
  points: STORED_TRACK.points,
};

const CARS_ON_TRACK = DRIVER_ENTRIES.slice(0, 10).map((d) => ({
  carIdx: d.carIdx,
  carNumber: d.carNumber,
  carClassColor: d.carClassColor,
  carClassId: d.carClassId,
  lapDistPct: d.lapDistPct,
  trackSurface: d.trackSurface,
  isPlayer: d.isPlayer,
  position: d.position,
  classPosition: d.classPosition,
}));

const CLASS_COLORS = [{ name: 'GTE', color: '#f59e0b' }];

const SECTORS = [
  { SectorNum: 0, SectorStartPct: 0.0 },
  { SectorNum: 1, SectorStartPct: 0.33 },
  { SectorNum: 2, SectorStartPct: 0.67 },
];

const DEFAULT_SETTINGS = {
  showLegend: true,
  legendPosition: 'right' as const,
  showSectors: true,
  showSectorTimes: true,
  showSectorsOnMap: false,
  rotationMode: 'fixed' as const,
  playerDotColor: '#22c55e',
  showPlayerLabel: true,
  leaderLabelMode: 'none' as const,
  trackStrokePx: 10,
  trackBorderPx: 2,
  sectorStrokePx: 3,
  targetDotRadiusPx: 6,
};

const DESIGN_SIZE = 600;

const meta: Meta<typeof TrackMapWidget> = {
  title: 'Widgets/TrackMapWidget',
  component: TrackMapWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: DESIGN_SIZE,
          height: DESIGN_SIZE,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    cars: CARS_ON_TRACK,
    classColors: CLASS_COLORS,
    trackData: TRACK_DATA,
    trackName: 'Lime Rock Park',
    isRecording: false,
    recordingProgress: 0,
    isForceStartPending: false,
    isWaitingForSF: false,
    settings: DEFAULT_SETTINGS,
    sectors: null,
    sectorTimes: [],
    currentSectorIdx: 0,
  },
};

export default meta;
type Story = StoryObj<typeof TrackMapWidget>;

export const Default: Story = {};

export const NoTrackData: Story = {
  args: {
    trackData: null,
  },
};

export const Recording: Story = {
  args: {
    trackData: null,
    isRecording: true,
    recordingProgress: 0.45,
  },
};

export const WithSectors: Story = {
  args: {
    sectors: SECTORS,
    sectorTimes: [63.4, 41.2, null],
    currentSectorIdx: 1,
    settings: {
      ...DEFAULT_SETTINGS,
      showSectorsOnMap: true,
      showSectorTimes: true,
    },
  },
};

export const NoLegend: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showLegend: false },
  },
};

export const AllLabels: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showPlayerLabel: true,
      leaderLabelMode: 'all',
    },
  },
};
