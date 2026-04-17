import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackMapWidget } from './TrackMapWidget';
import { WidgetScaler } from '../../WidgetScaler';
import {
  parseClassColor,
  formatClassShortName,
} from '../../../utils/class-color';
import type { TrackPoint } from '../../../utils/track-recorder';
import type { TrackMapWidgetSettings } from '../../../store/widget-settings.store';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import type { CarOnTrack } from './types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 400;
const DESIGN_HEIGHT = 400;

const realSnapshot = snapshot as TelemetrySnapshot;

const generateSyntheticOval = (): {
  points: TrackPoint[];
  svgPath: string;
  viewBox: string;
} => {
  const rx = 180;
  const ry = 70;
  const numPoints = 300;
  const points: TrackPoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const pct = i / numPoints;
    const angle = pct * 2 * Math.PI - Math.PI / 2;
    points.push({
      x: parseFloat((rx * Math.cos(angle)).toFixed(1)),
      y: parseFloat((ry * Math.sin(angle)).toFixed(1)),
      pct: i === numPoints ? 1.0 : pct,
    });
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 25;

  const viewBox = `${(minX - pad).toFixed(0)} ${(minY - pad).toFixed(0)} ${(maxX - minX + pad * 2).toFixed(0)} ${(maxY - minY + pad * 2).toFixed(0)}`;
  const svgPath = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;

  return { points, svgPath, viewBox };
};

const syntheticTrack = generateSyntheticOval();

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
  const carIdx = snap.carIdx;
  const drivers = snap.sessionInfo?.DriverInfo?.Drivers ?? [];
  const playerCarIdx = snap.sessionInfo?.DriverInfo?.DriverCarIdx ?? -1;
  if (!carIdx || drivers.length === 0) return [];

  return drivers
    .filter((d) => {
      const idx = d.CarIdx;
      if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
      if (idx >= carIdx.car_idx_position.length) return false;
      const pos = carIdx.car_idx_position[idx] ?? 0;
      const pct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
      return pos > 0 || pct >= 0;
    })
    .map((d): CarOnTrack => {
      const idx = d.CarIdx;
      return {
        carIdx: idx,
        carNumber: d.CarNumber ?? '',
        carClassColor: d.CarClassColor
          ? parseClassColor(d.CarClassColor)
          : '#888888',
        lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
        trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
        isPlayer: idx === playerCarIdx,
        position: carIdx.car_idx_position[idx] ?? 0,
      };
    });
};

const computeClassColors = (snap: TelemetrySnapshot) => {
  const drivers = snap.sessionInfo?.DriverInfo?.Drivers ?? [];
  const map = new Map<string, string>();
  for (const d of drivers) {
    const rawClass =
      d.CarClassShortName ||
      (d.CarClassRelSpeed != null ? `Class ${d.CarClassRelSpeed}` : 'Class');
    const name = formatClassShortName(
      rawClass,
      d.CarScreenName,
      d.CarClassID ?? undefined
    );
    if (!map.has(name)) {
      map.set(
        name,
        d.CarClassColor ? parseClassColor(d.CarClassColor) : '#888888'
      );
    }
  }
  return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
};

const TrackMapWidgetStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
  ...settings
}: TrackMapStoryArgs) => {
  const cars = computeCars(snap);
  const classColors = computeClassColors(snap);

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
          trackData={syntheticTrack}
          trackName="Lime Rock Park"
          isRecording={false}
          recordingProgress={0}
          playerYaw={undefined}
          settings={settings}
          sectors={snap.sessionInfo?.SplitTimeInfo?.Sectors}
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
