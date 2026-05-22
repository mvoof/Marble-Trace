import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { DriverEntriesFrame } from '@/types/bindings';
import type { ComputedStore } from '@store/iracing/computed.store';
import type {
  TelemetryStore,
  CarPositionsFrame,
} from '@store/iracing/telemetry.store';
import { useComputedStore, useTelemetryStore } from '@store/root-store-context';
import { driverEntries } from '@/storybook/test-data';
import { RelativeMapWidget } from './RelativeMapWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const TRACK_SURFACE_ON_TRACK = 1;

const DRIVER_ENTRIES = driverEntries;
const PLAYER_CAR_IDX =
  DRIVER_ENTRIES.find((entry) => entry.isPlayer)?.carIdx ?? 0;

const buildCarPositions = (): CarPositionsFrame => {
  const maxCarIdx = Math.max(...DRIVER_ENTRIES.map((e) => e.carIdx));
  const car_idx_lap_dist_pct = new Array(maxCarIdx + 1).fill(0);
  const car_idx_track_surface = new Array(maxCarIdx + 1).fill(
    TRACK_SURFACE_ON_TRACK
  );

  DRIVER_ENTRIES.forEach((entry, idx) => {
    car_idx_lap_dist_pct[entry.carIdx] = (idx / DRIVER_ENTRIES.length) % 1;
  });

  return { car_idx_lap_dist_pct, car_idx_track_surface };
};

const applyArgs = (stores: {
  computed: ComputedStore;
  telemetry: TelemetryStore;
}) => {
  runInAction(() => {
    stores.computed.updateStandings({
      entries: DRIVER_ENTRIES,
      playerCarIdx: PLAYER_CAR_IDX,
    } as DriverEntriesFrame);
    stores.telemetry.updateCarPositions(buildCarPositions());
  });
};

const StoryHost = () => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();

  useLayoutEffect(() => {
    applyArgs({ computed, telemetry });
  }, [computed, telemetry]);

  return <RelativeMapWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/RelativeMapWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [withStore(), widgetDecorator({ width: 400, height: 40 })],
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  decorators: [widgetDecorator({ width: 40, height: 300 })],
};

export const Wide: Story = {
  decorators: [widgetDecorator({ width: 700, height: 40 })],
};
