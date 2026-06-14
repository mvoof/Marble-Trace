import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapDeltaFrame } from '@/types/bindings';
import { useStore } from '@store/root-store-context';
import { LapFlash } from './LapFlash/LapFlash';
import { DeltaWidget } from './DeltaWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const EMPTY_LAP_DELTA = {
  sectorTimes: [],
  currentSectorIdx: 0,
  sectorDeltas: [],
} as LapDeltaFrame;

const meta: Meta = {
  title: 'Widgets/DeltaWidget',
  ...defineWidgetStories({
    widget: DeltaWidget,
    size: { width: 200, height: 100 },
    seed: (store) => {
      store.widgetSettings.updateUserSettings('delta', {
        reference: 'personal_best',
        showLapFlash: false,
      });

      store.backendComputed.updateLapDelta(EMPTY_LAP_DELTA);
    },
  }),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};

const BestLapHost = () => {
  const store = useStore();

  useLayoutEffect(() => {
    runInAction(() => {
      store.widgetSettings.updateUserSettings('delta', {
        reference: 'personal_best',
        showLapFlash: true,
        flashDuration: 999,
      });

      store.backendComputed.updateLapDelta(EMPTY_LAP_DELTA);

      store.backendComputed.lastCompletedLap = { lapNum: 5, delta: -1.235 };
      store.backendComputed.lapHistory = [
        { lapNum: 5, lapTime: 89.342, delta: -1.235, isBest: true },
      ];

      store.player.lapTiming = {
        ...(store.player.lapTiming ?? {}),
        lap_last_lap_time: 89.342,
        lap_best_lap_time: 89.342,
      } as typeof store.player.lapTiming;
    });
  }, [store]);

  return <DeltaWidget />;
};

export const BestLap: Story = {
  name: 'Best Lap Flash',
  render: () => <BestLapHost />,
};

export const FlashAhead: Story = {
  name: 'Flash: Ahead',
  render: () => (
    <LapFlash lapNum={12} lapTime={89.342} delta={-0.521} isBest={false} />
  ),
};

export const FlashBehind: Story = {
  name: 'Flash: Behind',
  render: () => (
    <LapFlash lapNum={12} lapTime={91.123} delta={0.812} isBest={false} />
  ),
};

export const FlashNewBest: Story = {
  name: 'Flash: New Best',
  render: () => <LapFlash lapNum={12} lapTime={89.342} delta={-1.235} isBest />,
};
