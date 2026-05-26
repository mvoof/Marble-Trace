import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapTimingFrame, LapDeltaFrame } from '@/types/bindings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useTelemetryStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { LapLogWidget } from './LapLogWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

interface StoryArgs {
  liveDelta: number;
  currentLapTime: number;
  bestLapTime: number;
  lapNum: number;
  reference: 'personal_best' | 'session_best';
}

const applyArgs = (
  stores: {
    telemetry: TelemetryStore;
    computed: BackendComputedStore;
    widgetSettings: WidgetSettingsStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.telemetry.updateLapTiming({
      lap: args.lapNum,
      lap_dist: null,
      lap_dist_pct: 0.42,
      lap_current_lap_time: args.currentLapTime,
      lap_last_lap_time: 89.512,
      lap_best_lap_time: args.bestLapTime,
      player_car_position: 3,
      player_car_class_position: 3,
      lap_delta_to_session_best_live: args.liveDelta,
      lap_delta_to_session_optimal_live: args.liveDelta,
    } as LapTimingFrame);

    stores.computed.updateLapDelta({
      sectorTimes: [],
      currentSectorIdx: 0,
      sessionBestTotal: args.liveDelta,
      sessionBestSectors: [],
      personalBestTotal: args.liveDelta,
      personalBestSectors: [],
    } as LapDeltaFrame);

    stores.widgetSettings.updateUserSettings('lap-log', {
      reference: args.reference,
    });
  });
};

const StoryHost = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ telemetry, computed, widgetSettings }, args);
  }, [args, telemetry, computed, widgetSettings]);

  return <LapLogWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/LapLogWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-flex', minWidth: 220 }),
  ],
  args: {
    liveDelta: -0.312,
    currentLapTime: 42.18,
    bestLapTime: 88.107,
    lapNum: 9,
    reference: 'personal_best',
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const Behind: Story = {
  args: { liveDelta: 0.845 },
};

export const NoHistory: Story = {
  args: { lapNum: 1, currentLapTime: 12.3, bestLapTime: 0 },
};
