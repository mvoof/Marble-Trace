import type { Meta, StoryObj } from '@storybook/react-vite';

import type { DriverEntriesFrame } from '@/types/bindings';
import type { CarPositionsFrame } from '@/types/bindings';
import { driverEntries } from '@/storybook/test-data';
import { RelativeMapWidget } from './RelativeMapWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const TRACK_SURFACE_ON_TRACK = 1;

const DRIVER_ENTRIES = driverEntries;
const PLAYER_CAR_IDX =
  DRIVER_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const buildCarPositions = (): CarPositionsFrame => {
  const maxCarIdx = Math.max(...DRIVER_ENTRIES.map((entry) => entry.carIdx));
  const car_idx_lap_dist_pct: number[] = new Array<number>(maxCarIdx + 1).fill(
    0
  );
  const car_idx_track_surface: number[] = new Array<number>(maxCarIdx + 1).fill(
    TRACK_SURFACE_ON_TRACK
  );

  DRIVER_ENTRIES.forEach((entry, idx) => {
    car_idx_lap_dist_pct[entry.carIdx] = (idx / DRIVER_ENTRIES.length) % 1;
  });

  return { car_idx_lap_dist_pct, car_idx_track_surface };
};

const meta: Meta = {
  title: 'Widgets/RelativeMapWidget',
  ...defineWidgetStories({
    widget: RelativeMapWidget,
    size: { width: 400, height: 40 },
    seed: (store) => {
      store.backendComputed.updateStandings({
        entries: DRIVER_ENTRIES,
        playerCarIdx: PLAYER_CAR_IDX,
      } as DriverEntriesFrame);
      store.cars.updateCarPositions(buildCarPositions());
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
