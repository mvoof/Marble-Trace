import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type {
  CarIdxFrame,
  DriverEntriesFrame,
  LapDeltaFrame,
  LapTimingFrame,
} from '@/types/bindings';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';
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

const CLASS_ID = 1;

const DEFAULT_SETTINGS: LapTimesWidgetSettings = {
  showLastLap: true,
  showBestLap: true,
  showP1: true,
  showPredicted: true,
  layout: 'vertical',
};

const DEFAULT_STANDINGS: DriverEntriesFrame = {
  playerCarIdx: 0,
  entries: [
    {
      carIdx: 0,
      isPlayer: true,
      carClassId: CLASS_ID,
      position: 2,
      classPosition: 2,
      userName: 'Player',
      carNumber: '1',
      iRating: 2000,
      lapDistPct: 0,
      carScreenNameShort: 'GTP',
      carClassColor: 0xffffff,
    },
    {
      carIdx: 1,
      isPlayer: false,
      carClassId: CLASS_ID,
      position: 1,
      classPosition: 1,
      userName: 'Leader',
      carNumber: '2',
      iRating: 2500,
      lapDistPct: 0,
      carScreenNameShort: 'GTP',
      carClassColor: 0xffffff,
    },
  ],
};

const DEFAULT_CAR_IDX: CarIdxFrame = {
  car_idx_lap_dist_pct: [0.4, 0.5],
  car_idx_best_lap_time: [82.891, 81.5],
};

interface StoryArgs {
  currentLapSec: number;
  lastLapSec: number | null;
  bestLapSec: number | null;
  personalBestDelta: number | null;
  p1BestLapSec: number;
  settings: LapTimesWidgetSettings;
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

    stores.telemetry.updateCarIdx({
      ...DEFAULT_CAR_IDX,
      car_idx_best_lap_time: [args.bestLapSec ?? 0, args.p1BestLapSec],
    } as CarIdxFrame);

    stores.computed.updateStandings(DEFAULT_STANDINGS);

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
    widgetDecorator({ display: 'inline-block', minWidth: 200 }),
  ],
  args: {
    currentLapSec: 83.456,
    lastLapSec: 84.102,
    bestLapSec: 82.891,
    personalBestDelta: -0.565,
    p1BestLapSec: 81.5,
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

export const P1IsPlayer: Story = {
  args: { p1BestLapSec: 83.5 },
};
