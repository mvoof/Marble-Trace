import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapDeltaFrame, LapTimingFrame } from '@/types/bindings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useTelemetryStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { LapTimesWidget } from './LapTimesWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

interface StoryArgs {
  currentLapSec: number;
  lastLapSec: number | null;
  bestLapSec: number | null;
  personalBestDelta: number | null;
  showPredicted: boolean;
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
      lap_current_lap_time: args.currentLapSec,
      lap_last_lap_time: args.lastLapSec,
      lap_best_lap_time: args.bestLapSec,
    } as LapTimingFrame);

    stores.computed.updateLapDelta({
      sectorTimes: [],
      currentSectorIdx: 0,
      sectorDeltas: [],
    } as LapDeltaFrame);

    stores.widgetSettings.updateUserSettings('lap-times', {
      reference: 'personal_best',
      showPredicted: args.showPredicted,
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

  return <LapTimesWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/LapTimesWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-block', minWidth: 360 }),
  ],
  args: {
    currentLapSec: 83.456,
    lastLapSec: 84.102,
    bestLapSec: 82.891,
    personalBestDelta: -0.565,
    showPredicted: true,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Ahead: Story = {};

export const Behind: Story = {
  args: { personalBestDelta: 0.646 },
};

export const NoPredicted: Story = {
  args: { showPredicted: false },
};

export const NoData: Story = {
  args: {
    currentLapSec: 0,
    lastLapSec: null,
    bestLapSec: null,
    personalBestDelta: null,
  },
};
