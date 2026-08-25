import type { Meta, StoryObj } from '@storybook/react-vite';

import type { LateralSide, NearbyCar, ProximityFrame } from '@/types/bindings';
import { ProximityRadarWidget } from './ProximityRadarWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const CAR_LENGTH_M = 4.6;

/**
 * The scope reads `nearbyCars` alone, so a story is a list of cars — the
 * bumper gap is derived here exactly as the backend derives it.
 */
const car = (
  carIdx: number,
  longitudinalDist: number,
  lateralSide: LateralSide
): NearbyCar => {
  const clearance = Math.abs(longitudinalDist);

  return {
    carIdx,
    longitudinalDist,
    lateralSide,
    clearance,
    bumperDist:
      Math.max(0, clearance - CAR_LENGTH_M) * Math.sign(longitudinalDist || 1),
  };
};

const frameOf = (nearbyCars: NearbyCar[]): ProximityFrame => ({
  nearbyCars,
  radarDistances: {
    frontDist: 999,
    rearDist: 999,
    leftDist: null,
    rightDist: null,
  },
  spotterLeft: nearbyCars.some((entry) => entry.lateralSide === 'left'),
  spotterRight: nearbyCars.some((entry) => entry.lateralSide === 'right'),
});

interface StoryArgs {
  proximity: ProximityFrame;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/ProximityRadarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: ProximityRadarWidget,
    size: { width: 180, height: 180 },
    seed: (store, args) => {
      store.appSettings.dragMode = true;
      store.backendComputed.updateProximity(args.proximity);
    },
    args: { proximity: frameOf([]) },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const NoCars: Story = {};

export const CarLeft: Story = {
  args: { proximity: frameOf([car(1, 1.2, 'left')]) },
};

export const CarRight: Story = {
  args: { proximity: frameOf([car(2, -0.8, 'right')]) },
};

export const CarsBothSides: Story = {
  args: {
    proximity: frameOf([car(1, 1.5, 'left'), car(2, -1, 'right')]),
  },
};

export const CarAhead: Story = {
  args: { proximity: frameOf([car(3, 8, 'center')]) },
};

export const CarBehind: Story = {
  args: { proximity: frameOf([car(4, -6.5, 'center')]) },
};

/** Two alongside in the same row — one body carrying a `×2`. */
export const TwoCarsOneSide: Story = {
  args: {
    proximity: frameOf([car(1, 0.4, 'left'), car(5, 1.1, 'left')]),
  },
};

/** A queue alongside: drawn where each car really is along the lane. */
export const QueueAlongside: Story = {
  args: {
    proximity: frameOf([car(1, 0.5, 'right'), car(5, -5.5, 'right')]),
  },
};

export const Surrounded: Story = {
  args: {
    proximity: frameOf([
      car(1, 1.2, 'left'),
      car(2, -1, 'right'),
      car(3, 7.5, 'center'),
      car(4, -7, 'center'),
    ]),
  },
};
