import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type {
  LapTimingFrame,
  LapDeltaFrame,
  SessionInfo,
} from '@/types/bindings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useTelemetryStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { SectorMatrixWidget } from './SectorMatrixWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

interface StoryArgs {
  delta: number;
  lapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  lapDistPct: number;
  sectorTimes: (number | null)[];
  sectorDeltas: (number | null)[];
  currentSectorIdx: number;
}

const applyArgs = (
  stores: {
    telemetry: TelemetryStore;
    computed: BackendComputedStore;
    widgetSettings: WidgetSettingsStore;
  },
  args: StoryArgs
) => {
  const sectorCount = args.sectorTimes.length || 3;

  runInAction(() => {
    stores.telemetry.updateLapTiming({
      lap: 3,
      lap_dist: null,
      lap_dist_pct: args.lapDistPct,
      lap_current_lap_time: args.lapTime,
      lap_last_lap_time: args.lastLapTime,
      lap_best_lap_time: args.bestLapTime,
      player_car_position: 1,
      player_car_class_position: 1,
      lap_delta_to_session_best_live: args.delta,
      lap_delta_to_session_optimal_live: args.delta,
    } as LapTimingFrame);

    stores.telemetry.updateSessionInfo({
      SplitTimeInfo: {
        Sectors: Array.from({ length: sectorCount }, (_, idx) => ({
          SectorNum: idx,
          SectorStartPct: idx / sectorCount,
        })),
      },
    } as unknown as SessionInfo);

    stores.computed.updateLapDelta({
      sectorTimes: args.sectorTimes,
      currentSectorIdx: args.currentSectorIdx,
      sessionBestTotal: args.delta,
      sessionBestSectors: args.sectorDeltas,
      personalBestTotal: args.delta,
      personalBestSectors: args.sectorDeltas,
    } as LapDeltaFrame);

    stores.widgetSettings.updateUserSettings('sector-matrix', {
      reference: 'personal_best',
      showPredicted: true,
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

  return <SectorMatrixWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/SectorMatrixWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-flex', minWidth: 320 }),
  ],
  args: {
    delta: -0.412,
    lapTime: 68.732,
    lastLapTime: 109.01,
    bestLapTime: 108.733,
    lapDistPct: 0.42,
    sectorTimes: [22.1, 31.4, null],
    sectorDeltas: [-0.12, 0.08, null],
    currentSectorIdx: 2,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const Behind: Story = {
  args: {
    delta: 0.612,
    sectorDeltas: [0.21, 0.15, null],
  },
};

export const ManySectors: Story = {
  args: {
    delta: -0.215,
    sectorTimes: [
      8.1,
      7.9,
      8.3,
      7.8,
      8.5,
      7.6,
      8.2,
      8.0,
      null,
      null,
      null,
      null,
    ],
    sectorDeltas: [
      -0.05,
      0.03,
      -0.08,
      0.01,
      -0.12,
      0.04,
      -0.06,
      0.02,
      null,
      null,
      null,
      null,
    ],
    currentSectorIdx: 8,
  },
};

export const NoData: Story = {
  args: {
    delta: 0,
    lapTime: 0,
    lastLapTime: 0,
    bestLapTime: 0,
    lapDistPct: 0,
    sectorTimes: [],
    sectorDeltas: [],
    currentSectorIdx: 0,
  },
};
