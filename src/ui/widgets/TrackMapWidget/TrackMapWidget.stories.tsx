import type { Meta, StoryObj } from '@storybook/react-vite';

import type { TrackMapWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import {
  PACE_CAR_IDX,
  mockField,
  mockPaceCarEntry,
} from '@store/preview/mocks/field';
import { mockSectors } from '@store/preview/mocks/timing';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';
import { trackData as STORED_TRACK } from '@/storybook/test-data';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { TrackMapView } from './TrackMapView/TrackMapView';
import { withStore } from '../../../../.storybook/decorators';

const TRACK_DATA = {
  svgPath: STORED_TRACK.svgPath,
  viewBox: STORED_TRACK.viewBox,
  points: STORED_TRACK.points,
};

const DESIGN_SIZE = 600;
const SECTOR_COUNT = 3;

/** The lap the spacing below is measured against, in seconds. */
const LAP_TIME_S = 92.4;
/** Only the leading cars are drawn, so they are spread over the whole lap. */
const MAPPED_CAR_COUNT = 10;

const PACE_CAR_LAP_PCT = 0.35;
const TRACK_SURFACE_ON_TRACK = 3;

const INCIDENT_LAP_DIST_PCT = 0.43;
const CLEARED_LAP_DIST_PCT = 0.78;

// The map draws one dot per car off its own lap distance, so the field is
// spread over the whole lap rather than packed into the seconds around the
// player: a gap of a lap divided by the field is one car every equal step.
const seedField = (store: RootStore) => {
  const base = store.backendComputed.driverEntries;

  if (!base || base.entries.length === 0) {
    return;
  }

  const { driverEntries, relative } = mockField(base.entries, {
    gapS: LAP_TIME_S / MAPPED_CAR_COUNT,
    lapTimeS: LAP_TIME_S,
  });

  store.backendComputed.updateDriverEntries(driverEntries);
  store.backendComputed.updateRelative(relative);
};

/** Everything every story here shares: a connected sim, the snapshot, the field. */
const seedMap = (store: RootStore) => {
  store.sim.isConnected = true;
  seedFromSnapshot(store);
  seedField(store);
};

const withMap = (
  extra?: (store: RootStore) => void,
  settings?: Partial<TrackMapWidgetSettings>
) =>
  withStore((store) => {
    seedMap(store);

    if (settings) {
      store.liveWidgets.updateUserSettings('track-map', settings);
    }

    extra?.(store);
  });

// A safety car reaches the map through the session roster and the per-car
// arrays rather than as a driver entry, the way the sim reports it.
const seedPaceCar = (store: RootStore) => {
  const sessionInfo = store.session.sessionInfo;
  const positions = store.cars.carPositions;
  const player = store.backendComputed.driverEntries?.entries.find(
    (entry) => entry.isPlayer
  );

  if (!sessionInfo || !positions) {
    return;
  }

  const template = sessionInfo.cars[0];

  store.session.updateSessionInfo({
    ...sessionInfo,
    cars: [
      ...sessionInfo.cars,
      mockPaceCarEntry(template, {
        carClassId: player?.carClassId ?? template.carClassId,
        carClassColor: player?.carClassColor ?? template.carClassColor,
      }),
    ],
  });

  const lapDist = [...positions.car_idx_lap_dist_pct];
  const surface = [...positions.car_idx_track_surface];

  lapDist[PACE_CAR_IDX] = PACE_CAR_LAP_PCT;
  surface[PACE_CAR_IDX] = TRACK_SURFACE_ON_TRACK;

  store.cars.updateCarPositions({
    ...positions,
    car_idx_lap_dist_pct: lapDist,
    car_idx_track_surface: surface,
  });
};

const seedSectors = (store: RootStore) => {
  const sessionInfo = store.session.sessionInfo;

  if (sessionInfo) {
    store.session.updateSessionInfo({
      ...sessionInfo,
      sectors: mockSectors(SECTOR_COUNT),
    });
  }
};

const seedIncidents = (store: RootStore) => {
  store.backendComputed.updateIncidents({
    incidents: [
      {
        carIdx: 1,
        lapDistPct: INCIDENT_LAP_DIST_PCT,
        kind: 'stopped',
        isActive: true,
      },
      {
        carIdx: 2,
        lapDistPct: CLEARED_LAP_DIST_PCT,
        kind: 'offTrack',
        isActive: false,
      },
    ],
  });
};

const meta: Meta<typeof TrackMapView> = {
  title: 'Widgets/TrackMapWidget',
  component: TrackMapView,
  parameters: { layout: 'centered' },
  decorators: [
    withMap(),
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
  decorators: [withMap(seedSectors, { showSectorsOnMap: true })],
};

export const ClassShapes: Story = {
  decorators: [withMap(undefined, { classShapes: true })],
};

export const WaitingForSF: Story = {
  args: {
    trackData: null,
    isWaitingForSF: true,
  },
};

export const WithPaceCar: Story = {
  decorators: [withMap(seedPaceCar)],
};

export const WithIncidentZones: Story = {
  decorators: [
    withMap(seedIncidents, {
      showIncidentZones: true,
      blinkIncidentZones: true,
      flagZoneStyle: 'filled',
    }),
  ],
};

export const WithOutlinedIncidentZones: Story = {
  decorators: [
    withMap(seedIncidents, {
      showIncidentZones: true,
      blinkIncidentZones: true,
      flagZoneStyle: 'outline',
    }),
  ],
};
