import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackSurface } from '@/types';
import type { DriverEntry, RelativeFrame } from '@/types/bindings';
import { driverEntries, snapshot } from '@/storybook/test-data';
import { RelativeMapWidget } from './RelativeMapWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { withStore } from '../../../.storybook/decorators';

const PLAYER_CAR_IDX =
  driverEntries.find((entry) => entry.isPlayer)?.carIdx ?? 0;

// LinearMap reads the relative frame and positions each car dot from its own
// lapDistPct, so spread the cars around the lap and mark them on-track.
const MAP_ENTRIES: DriverEntry[] = driverEntries.map((entry, idx) => ({
  ...entry,
  trackSurface: TrackSurface.OnTrack,
  lapDistPct: (idx / driverEntries.length) % 1,
}));

const meta: Meta = {
  title: 'Widgets/RelativeMapWidget',
  ...defineWidgetStories({
    widget: RelativeMapWidget,
    size: { width: 400, height: 40 },
    seed: (store) => {
      store.backendComputed.updateRelative({
        entries: MAP_ENTRIES,
        playerCarIdx: PLAYER_CAR_IDX,
      } as RelativeFrame);
    },
  }),
};

export default meta;
type Story = StoryObj;

export const Horizontal: Story = {};

export const Vertical: Story = {
  parameters: { widgetFrame: { width: 40, height: 300 } },
};

export const Wide: Story = {
  parameters: { widgetFrame: { width: 700, height: 40 } },
};

const PACE_CAR_IDX = 61;
const PACE_CAR_LAP_PCT = 0.08;
const TRACK_SURFACE_ON_TRACK = 3;

export const WithPaceCar: Story = {
  decorators: [
    withStore((store) => {
      const player = driverEntries.find((entry) => entry.isPlayer);

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

      store.backendComputed.updateRelative({
        entries: MAP_ENTRIES,
        playerCarIdx: PLAYER_CAR_IDX,
      } as RelativeFrame);

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
