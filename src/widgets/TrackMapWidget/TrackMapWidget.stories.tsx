import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackMapView } from './TrackMapView/TrackMapView';
import {
  driverEntries as DRIVER_ENTRIES,
  trackData as STORED_TRACK,
  snapshot,
} from '@/storybook/test-data';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

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
      store.backendComputed.updateStandings({
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

      store.backendComputed.updateStandings({
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

export const WaitingForSF: Story = {
  args: {
    trackData: null,
    isWaitingForSF: true,
  },
};
