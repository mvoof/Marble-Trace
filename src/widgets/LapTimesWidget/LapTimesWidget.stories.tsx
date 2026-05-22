import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapTimingFrame } from '@/types/bindings';
import type { LapDeltaFrame } from '@/types/bindings';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { ComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useTelemetryStore,
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { LapTimesWidget } from './LapTimesWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const DEFAULT_SETTINGS: LapTimesWidgetSettings = {
  showLastLap: true,
  showBestLap: true,
  showP1: true,
  showPredicted: true,
  layout: 'vertical',
};

interface StoryArgs {
  currentLapSec: number;
  lastLapSec: number | null;
  bestLapSec: number | null;
  personalBestDelta: number | null;
  settings: LapTimesWidgetSettings;
}

const applyArgs = (
  stores: {
    telemetry: TelemetryStore;
    computed: ComputedStore;
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
      personalBestTotal: args.personalBestDelta,
      sessionBestTotal: args.personalBestDelta,
      sectorTimes: [],
      currentSectorIdx: 0,
      personalBestSectors: [],
      sessionBestSectors: [],
    } as LapDeltaFrame);

    stores.widgetSettings.updateUserSettings('lap-times', args.settings);
  });
};

const StoryHost = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const computed = useComputedStore();
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
    widgetDecorator({ display: 'inline-block', minWidth: 200 }),
  ],
  args: {
    currentLapSec: 83.456,
    lastLapSec: 84.102,
    bestLapSec: 82.891,
    personalBestDelta: -0.565,
    settings: DEFAULT_SETTINGS,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const DefaultVertical: Story = {};

export const Horizontal: Story = {
  decorators: [widgetDecorator({ width: 1150 })],
  args: {
    settings: { ...DEFAULT_SETTINGS, layout: 'horizontal' },
  },
};

export const CurrentOnly: Story = {
  args: {
    settings: {
      ...DEFAULT_SETTINGS,
      showLastLap: false,
      showBestLap: false,
      showP1: false,
    },
  },
};

export const Ahead: Story = {
  args: { personalBestDelta: -0.211 },
};

export const Behind: Story = {
  args: { personalBestDelta: 0.646 },
};

export const NoData: Story = {
  args: {
    currentLapSec: 0,
    lastLapSec: null,
    bestLapSec: null,
    personalBestDelta: null,
  },
};

export const PersonalBestSet: Story = {
  args: { personalBestDelta: 0 },
};

export const NoPredicted: Story = {
  args: {
    settings: { ...DEFAULT_SETTINGS, showPredicted: false },
  },
};
