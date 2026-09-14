import type { Meta, StoryObj } from '@storybook/react-vite';

import type { RootStore } from '@store/root-store';
import { mockField } from '@store/preview/mocks/field';
import { mockSectors } from '@store/preview/mocks/timing';
import { sampleTrack } from '@store/preview/sample-track';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';
import { TrackMapView } from './TrackMapView/TrackMapView';

const TRACK_DATA = {
  svgPath: sampleTrack.svgPath,
  viewBox: sampleTrack.viewBox,
  points: sampleTrack.points,
};

const DESIGN_SIZE = 600;
const SECTOR_COUNT = 3;

/** The lap the spacing below is measured against, in seconds. */
const LAP_TIME_S = 92.4;
/** Only the leading cars are drawn, so they are spread over the whole lap. */
const MAPPED_CAR_COUNT = 10;

interface StoryArgs {
  trackData: typeof TRACK_DATA | null;
  isRecording: boolean;
  recordingProgress: number;
  isWaitingForSF: boolean;

  showSectorsOnMap: boolean;
  classShapes: boolean;
  showIncidentZones: boolean;
  blinkIncidentZones: boolean;
  flagZoneStyle: 'filled' | 'outline';
}

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

// The lap's splits are on the session rather than on a frame, and the recorded
// one carries none — so the sector story states them where the map reads them.
const seedSectors = (store: RootStore) => {
  const sessionInfo = store.session.sessionInfo;

  if (!sessionInfo) {
    return;
  }

  store.session.updateSessionInfo({
    ...sessionInfo,
    sectors: mockSectors(SECTOR_COUNT),
  });
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/TrackMapWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: TrackMapView,
    size: { width: DESIGN_SIZE, height: DESIGN_SIZE },
    seedSnapshot: true,
    seed: (store, args) => {
      seedField(store);

      if (args.showSectorsOnMap) {
        seedSectors(store);
      }

      store.liveWidgets.updateUserSettings('track-map', {
        showSectorsOnMap: args.showSectorsOnMap,
        classShapes: args.classShapes,
        showIncidentZones: args.showIncidentZones,
        blinkIncidentZones: args.blinkIncidentZones,
        flagZoneStyle: args.flagZoneStyle,
      });
    },
    args: {
      trackData: TRACK_DATA,
      isRecording: false,
      recordingProgress: 0,
      isWaitingForSF: false,
      showSectorsOnMap: false,
      classShapes: false,
      showIncidentZones: true,
      blinkIncidentZones: true,
      flagZoneStyle: 'filled',
    },
    argTypes: {
      flagZoneStyle: {
        control: 'inline-radio',
        options: ['filled', 'outline'],
      },
      recordingProgress: {
        control: { type: 'range', min: 0, max: 1, step: 0.05 },
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Recording: Story = {
  args: {
    trackData: null,
    isRecording: true,
    recordingProgress: 0.45,
  },
};

export const WithSectors: Story = {
  args: { showSectorsOnMap: true },
};

export const ClassShapes: Story = {
  args: { classShapes: true },
};

export const WaitingForSF: Story = {
  args: {
    trackData: null,
    isWaitingForSF: true,
  },
};

export const WithPaceCar: Story = {
  parameters: previewScenario('pace-car-on-track'),
};

export const WithIncidentZones: Story = {
  parameters: previewScenario('incident-zones'),
};

export const WithOutlinedIncidentZones: Story = {
  parameters: previewScenario('incident-zones'),
  args: { flagZoneStyle: 'outline' },
};
