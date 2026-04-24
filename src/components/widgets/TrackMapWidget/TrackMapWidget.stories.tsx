import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackMapWidget } from './TrackMapWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { TrackMapWidgetSettings } from '../../../types/widget-settings';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import type { CarOnTrack } from './types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';
import tracksData from '../../../../test-data/tracks.json';

const DESIGN_WIDTH = 400;
const DESIGN_HEIGHT = 400;

const realSnapshot = snapshot as TelemetrySnapshot;

const storedTracks = tracksData as {
  'recorded-tracks': Record<
    string,
    {
      svgPath: string;
      viewBox: string;
      points: { x: number; y: number; pct: number }[];
    }
  >;
};
const realTrack = Object.values(storedTracks['recorded-tracks'])[0] ?? null;

const DEFAULT_SETTINGS: TrackMapWidgetSettings = {
  showLegend: true,
  legendPosition: 'right',
  showSectors: true,
  showCornerNumbers: true,
  rotationMode: 'fixed',
};

interface TrackMapStoryArgs extends TrackMapWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const computeCars = (snap: TelemetrySnapshot): CarOnTrack[] => {
  const entries = computeDriverEntries(
    snap.carIdx,
    snap.sessionInfo?.DriverInfo ?? null
  );
  return entries.map((e) => ({
    carIdx: e.carIdx,
    carNumber: e.carNumber,
    carClassColor: e.carClassColor,
    carClassId: e.carClassId,
    lapDistPct: e.lapDistPct,
    trackSurface: e.trackSurface,
    isPlayer: e.isPlayer,
    position: e.position,
    classPosition: e.classPosition,
  }));
};

const computeClassColors = (snap: TelemetrySnapshot) => {
  const entries = computeDriverEntries(
    snap.carIdx,
    snap.sessionInfo?.DriverInfo ?? null
  );
  const seen = new Map<number, { name: string; color: string }>();
  for (const e of entries) {
    if (!seen.has(e.carClassId)) {
      seen.set(e.carClassId, {
        name: e.carClassShortName,
        color: e.carClassColor,
      });
    }
  }
  return Array.from(seen.values());
};

const MOCK_SECTOR_TIMES: (number | null)[] = [31.423, 45.102, 29.851, null];

const TrackMapWidgetStory = ({
  snapshot: snap,
  ...settings
}: TrackMapStoryArgs) => {
  const cars = computeCars(snap);
  const classColors = computeClassColors(snap);
  const playerYaw =
    settings.rotationMode === 'heading-up'
      ? (snap.carDynamics?.yaw ?? undefined)
      : undefined;

  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="transparent"
      >
        <TrackMapWidget
          cars={cars}
          classColors={classColors}
          trackData={realTrack}
          trackName="Lime Rock Park"
          isRecording={false}
          recordingProgress={0}
          playerYaw={playerYaw}
          settings={settings}
          sectors={snap.sessionInfo?.SplitTimeInfo?.Sectors}
          sectorTimes={MOCK_SECTOR_TIMES}
        />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<TrackMapStoryArgs> = {
  title: 'Widgets/TrackMapWidget',
  component: TrackMapWidgetStory,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#1a1a2e' }],
    },
  },
  args: {
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<TrackMapStoryArgs>;

export const Default: Story = {};

export const NoLegend: Story = {
  args: { showLegend: false },
};

export const NoSectors: Story = {
  args: { showSectors: false },
};

export const NoCornerNumbers: Story = {
  args: { showCornerNumbers: false },
};

export const HeadingUp: Story = {
  args: { rotationMode: 'heading-up' },
};

export const Recording: Story = {
  render: ({ snapshot: snap, ...settings }) => (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="transparent"
      >
        <TrackMapWidget
          cars={computeCars(snap)}
          classColors={computeClassColors(snap)}
          trackData={null}
          trackName="Lime Rock Park"
          isRecording={true}
          recordingProgress={0.42}
          playerYaw={undefined}
          settings={settings}
          sectors={undefined}
          sectorTimes={[]}
        />
      </WidgetScaler>
    </div>
  ),
};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carDynamics: null,
      carIdx: null,
      carInputs: null,
      carStatus: null,
      environment: null,
      lapTiming: null,
      session: null,
      sessionInfo: null,
    },
  },
};
