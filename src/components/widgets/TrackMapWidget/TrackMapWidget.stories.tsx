import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackMapWidget } from './TrackMapWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeDriverEntries } from '../widget-utils';
import type { TrackMapWidgetSettings } from '../../../store/widget-settings.store';
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
  containerWidth: number;
  containerHeight: number;
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
  containerWidth,
  containerHeight,
  ...settings
}: TrackMapStoryArgs) => {
  const cars = computeCars(snap);
  const classColors = computeClassColors(snap);
  const playerYaw =
    settings.rotationMode === 'heading-up'
      ? (snap.carDynamics?.yaw ?? undefined)
      : undefined;

  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
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

const TrackMapRecordingStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
  ...settings
}: TrackMapStoryArgs) => (
  <div style={{ width: containerWidth, height: containerHeight }}>
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
);

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
  argTypes: {
    containerWidth: {
      control: { type: 'range', min: 200, max: 800, step: 10 },
      description: 'Container width (px)',
      table: { category: 'Container' },
    },
    containerHeight: {
      control: { type: 'range', min: 200, max: 800, step: 10 },
      description: 'Container height (px)',
      table: { category: 'Container' },
    },
    showLegend: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    legendPosition: {
      control: 'radio',
      options: ['left', 'right', 'hidden'],
      table: { category: 'Widget Settings' },
    },
    showSectors: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    showCornerNumbers: {
      control: 'boolean',
      table: { category: 'Widget Settings' },
    },
    rotationMode: {
      control: 'radio',
      options: ['fixed', 'heading-up'],
      table: { category: 'Widget Settings' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    containerWidth: DESIGN_WIDTH,
    containerHeight: DESIGN_HEIGHT,
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<TrackMapStoryArgs>;

export const Default: Story = {};

export const LegendLeft: Story = {
  args: { legendPosition: 'left' },
};

export const NoLegend: Story = {
  args: { showLegend: false },
};

export const NoSectors: Story = {
  args: { showSectors: false },
};

export const Recording: Story = {
  render: (args) => <TrackMapRecordingStory {...args} />,
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
