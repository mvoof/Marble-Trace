import type { Meta, StoryObj } from '@storybook/react-vite';

import type { LinearMapWidgetSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import {
  PACE_CAR_IDX,
  mockField,
  mockPaceCarEntry,
} from '@store/preview/mocks/field';
import { RelativeMapWidget } from './RelativeMapWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

/** The lap the spacing below is measured against, in seconds. */
const LAP_TIME_S = 92.4;

const PACE_CAR_LAP_PCT = 0.08;
const TRACK_SURFACE_ON_TRACK = 3;

// The map draws one dot per car off its own lap distance, so the field is
// spread over the whole lap rather than packed into the seconds around the
// player: a gap of a lap divided by the field is one car every equal step.
const spreadOverLap = (store: RootStore) => {
  const base = store.backendComputed.driverEntries;

  if (!base || base.entries.length === 0) {
    return;
  }

  const { driverEntries, relative } = mockField(base.entries, {
    gapS: LAP_TIME_S / base.entries.length,
    lapTimeS: LAP_TIME_S,
  });

  store.backendComputed.updateDriverEntries(driverEntries);
  store.backendComputed.updateRelative(relative);
};

// A safety car reaches the map through the session roster and the per-car
// arrays rather than as a driver entry, the way the sim reports it.
const seedPaceCar = (store: RootStore) => {
  const sessionInfo = store.session.sessionInfo;
  const positions = store.cars.carPositions;
  const player = store.backendComputed.relativeEntries.find(
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

interface StoryArgs {
  /** The settings this story differs from the shipped defaults in. */
  settings?: Partial<LinearMapWidgetSettings>;
  /** A safety car of the player's own class, out on the lap. */
  paceCar?: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RelativeMapWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RelativeMapWidget,
    size: { width: 400, height: 40 },
    seedSnapshot: true,
    seed: (store, args) => {
      spreadOverLap(store);

      if (args.settings) {
        store.liveWidgets.updateUserSettings('relative-map', args.settings);
      }

      if (args.paceCar) {
        seedPaceCar(store);
      }
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  parameters: { widgetFrame: { width: 40, height: 300 } },
};

export const Wide: Story = {
  parameters: { widgetFrame: { width: 700, height: 40 } },
};

export const ClassShapes: Story = {
  parameters: { widgetFrame: { width: 700, height: 40 } },
  args: { settings: { classShapes: true } },
};

export const WithPaceCar: Story = {
  args: { paceCar: true },
};
