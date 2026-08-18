import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackMapView } from './TrackMapView/TrackMapView';
import {
  driverEntries as DRIVER_ENTRIES,
  trackData as STORED_TRACK,
  snapshot,
} from '@/storybook/test-data';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../../.storybook/decorators';

const TRACK_DATA = {
  svgPath: STORED_TRACK.svgPath,
  viewBox: STORED_TRACK.viewBox,
  points: STORED_TRACK.points,
};

const SECTORS = [
  { sectorNum: 0, sectorStartPct: 0.0 },
  { sectorNum: 1, sectorStartPct: 0.33 },
  { sectorNum: 2, sectorStartPct: 0.67 },
];

const DESIGN_SIZE = 600;

const meta: Meta<typeof TrackMapView> = {
  title: 'Widgets/TrackMapWidget',
  component: TrackMapView,
  parameters: { layout: 'centered' },
  decorators: [
    withStore((store) => {
      if (snapshot.sessionInfo)
        store.session.updateSessionInfo(snapshot.sessionInfo);
      store.backendComputed.updateDriverEntries({
        entries: DRIVER_ENTRIES.slice(0, 10),
        playerCarIdx: DRIVER_ENTRIES.find((d) => d.isPlayer)?.carIdx ?? 0,
      });
    }),
    widgetDecorator({ width: DESIGN_SIZE, height: DESIGN_SIZE }),
  ],
  args: {
    trackData: TRACK_DATA,
    isRecording: false,
    recordingProgress: 0,
    isWaitingForSF: false,
  },
};

export default meta;
type Story = StoryObj<typeof TrackMapView>;

export const Default: Story = {};

export const Recording: Story = {
  args: {
    trackData: null,
    isRecording: true,
    recordingProgress: 0.45,
  },
};

export const WithSectors: Story = {
  decorators: [
    withStore((store) => {
      if (snapshot.sessionInfo) {
        store.session.updateSessionInfo({
          ...snapshot.sessionInfo,
          sectors: SECTORS,
        });
      }

      store.backendComputed.updateDriverEntries({
        entries: DRIVER_ENTRIES.slice(0, 10),
        playerCarIdx: DRIVER_ENTRIES.find((d) => d.isPlayer)?.carIdx ?? 0,
      });
      store.widgetSettings.updateUserSettings('track-map', {
        showSectorsOnMap: true,
        showSectorTimes: true,
      });
    }),
  ],
};

export const ClassShapes: Story = {
  decorators: [
    withStore((store) => {
      if (snapshot.sessionInfo)
        store.session.updateSessionInfo(snapshot.sessionInfo);

      store.backendComputed.updateDriverEntries({
        entries: DRIVER_ENTRIES,
        playerCarIdx: DRIVER_ENTRIES.find((d) => d.isPlayer)?.carIdx ?? 0,
      });
      store.widgetSettings.updateUserSettings('track-map', {
        classShapes: true,
      });
    }),
  ],
};

export const WaitingForSF: Story = {
  args: {
    trackData: null,
    isWaitingForSF: true,
  },
};

const PACE_CAR_IDX = 61;
const PACE_CAR_LAP_PCT = 0.35;
const TRACK_SURFACE_ON_TRACK = 3;

export const WithPaceCar: Story = {
  decorators: [
    withStore((store) => {
      const player = DRIVER_ENTRIES.find((d) => d.isPlayer);

      if (snapshot.sessionInfo) {
        const template = snapshot.sessionInfo.cars[0];
        const paceCar = {
          ...template,
          carIdx: PACE_CAR_IDX,
          userName: 'Pace Car',
          carNumber: '0',
          isPaceCar: true,
          carClassId: player?.carClassId ?? template.carClassId,
          carClassColor: player?.carClassColor ?? template.carClassColor,
        };

        store.session.updateSessionInfo({
          ...snapshot.sessionInfo,
          cars: [...snapshot.sessionInfo.cars, paceCar],
        });
      }

      store.backendComputed.updateDriverEntries({
        entries: DRIVER_ENTRIES.slice(0, 10),
        playerCarIdx: player?.carIdx ?? 0,
      });

      const lapDist = new Array(PACE_CAR_IDX + 1).fill(-1);
      const surface = new Array(PACE_CAR_IDX + 1).fill(-1);
      lapDist[PACE_CAR_IDX] = PACE_CAR_LAP_PCT;
      surface[PACE_CAR_IDX] = TRACK_SURFACE_ON_TRACK;

      store.cars.updateCarPositions({
        car_idx_lap_dist_pct: lapDist,
        car_idx_track_surface: surface,
      });
    }),
  ],
};
