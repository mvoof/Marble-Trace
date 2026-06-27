import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrackSurface } from '@/types';
import type { DriverEntry, RelativeFrame } from '@/types/bindings';
import { driverEntries } from '@/storybook/test-data';
import { RelativeMapWidget } from './RelativeMapWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

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
