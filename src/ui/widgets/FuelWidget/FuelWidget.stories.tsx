import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FuelComputedFrame, FuelLapRecord } from '@/types/bindings';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import { mockLapTiming } from '@store/preview/mocks/delta';
import { mockCarStatus } from '@store/preview/mocks/engine';
import { mockFuel } from '@store/preview/mocks/fuel';
import { whenSet } from '@/storybook/story-overrides';
import { FuelWidget } from './FuelWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

const LAP_FUEL_USED = [
  3.2, 3.1, 3.3, 3, 3.2, 3.1, 3.4, 3, 2, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3,
  3, 4, 3.2, 3.5, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3.2, 3.5, 2, 3.2,
  3.1, 3.3, 3, 3.2, 3.1, 3.4, 3, 2, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4,
  3.2, 3.5, 5, 3, 3, 30, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3.2, 3.5, 2, 3.2, 3.1,
  6, 3.3, 3, 3.2, 3.1, 3.4, 3, 2, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4,
  3.2, 3.5, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3.2, 3.5, 2, 5, 3, 4,
];

// The lap the stint opened on plus a caution, so the grey bars and the gap they
// leave in the trend line are visible without hunting for a rejected lap.
const REJECTED_BY_LAP: Record<number, string> = {
  1: 'out-lap',
  9: 'caution',
  10: 'caution',
  73: 'outlier',
};

// A stint far longer than any scenario ships, which is what the chart has to
// survive: a hundred and thirty bars, an outlier and three rejected laps.
const LONG_LAP_FUEL_HISTORY: FuelLapRecord[] = LAP_FUEL_USED.map(
  (used, index) => {
    const lap = index + 1;

    return { lap, used, rejected: REJECTED_BY_LAP[lap] ?? null };
  }
);

interface StoryArgs {
  /**
   * The fuel readouts. Left undefined — which is what a story naming a scenario
   * does — the base's own value is kept, so a knob turned here states a
   * difference rather than replacing the frame.
   */
  fuelLevel?: number | null;
  avgPerLap?: number | null;
  lapsRemaining?: number | null;
  shortage?: number | null;
  fuelToAddWithBuffer?: number | null;
  pitWarning?: boolean;
  bestLapTime?: number | null;
  /** The long stint rather than the base's ten laps — what the chart is sized on. */
  longHistory: boolean;

  showChart: boolean;
  chartType: 'line' | 'bar';
  barWidth: number;
  pitWarningLaps: number;
  showNextStopForecast: boolean;
}

// Only the knobs a story actually turned reach the frame; everything else is
// left to the scenario or the snapshot underneath.
const fuelOverrides = (args: StoryArgs): Partial<FuelComputedFrame> => {
  const overrides: Partial<FuelComputedFrame> = {
    ...whenSet(args.avgPerLap, (avgPerLap) => ({ avgPerLap })),
    // The laps the tank holds and the laps left to run move together here: what
    // these stories vary is how far short the tank falls, stated by `shortage`.
    ...whenSet(args.lapsRemaining, (laps) => ({
      lapsRemaining: laps,
      lapsToFinish: laps,
    })),
    ...whenSet(args.shortage, (shortage) => ({ shortage })),
    ...whenSet(args.fuelToAddWithBuffer, (fuel) => ({
      fuelToAdd: fuel,
      fuelToAddWithBuffer: fuel,
    })),
    ...whenSet(args.pitWarning, (pitWarning) => ({ pitWarning })),
  };

  if (args.longHistory) {
    overrides.lapFuelHistory = LONG_LAP_FUEL_HISTORY;
  } else {
    // No history means no stint to summarise either, so the stats row goes with
    // it rather than keeping the base's numbers over an empty chart.
    overrides.lapFuelHistory = [];
    overrides.historyStats = null;
    overrides.refuelPlan = null;
  }

  return overrides;
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/FuelWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: FuelWidget,
    size: { width: 240, height: 360 },
    seedSnapshot: true,
    seed: (store, args) => {
      // The recorded snapshot was captured in the garage with the tank empty,
      // so the level a story states is put on the builder's running car rather
      // than patched onto that.
      // `null` is the no-data story's way of asking for the snapshot's empty
      // garage tank — the frame's own field is never nullable.
      if (typeof args.fuelLevel === 'number') {
        store.player.updateCarStatus(
          mockCarStatus({ fuel_level: args.fuelLevel })
        );
      }

      if (args.bestLapTime !== undefined) {
        store.player.updateLapTiming(
          mockLapTiming({
            lap_best_lap_time: args.bestLapTime,
            lap_last_lap_time: args.bestLapTime,
          })
        );
      }

      store.backendComputed.updateFuel(
        mockFuel({ ...store.backendComputed.fuel, ...fuelOverrides(args) })
      );

      store.liveWidgets.updateUserSettings('fuel', {
        ...store.liveWidgets.getSettings<FuelWidgetSettings>('fuel'),
        showChart: args.showChart,
        chartType: args.chartType,
        barWidth: args.barWidth,
        pitWarningLaps: args.pitWarningLaps,
        showNextStopForecast: args.showNextStopForecast,
      });
    },
    args: {
      fuelLevel: 28.5,
      bestLapTime: 92.4,
      longHistory: true,
      showChart: false,
      chartType: 'line',
      barWidth: 5,
      pitWarningLaps: 3,
      showNextStopForecast: true,
    },
    argTypes: {
      barWidth: { control: { type: 'range', min: 5, max: 20, step: 1 } },
      chartType: { control: 'inline-radio', options: ['line', 'bar'] },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Comfortable: Story = {
  args: { avgPerLap: 3.15, lapsRemaining: 9, shortage: 2.3, pitWarning: false },
};

export const NextStopForecast: Story = {
  args: { ...Comfortable.args },
};

export const NextStopForecastNoLapTime: Story = {
  args: { ...Comfortable.args, bestLapTime: null },
};

export const CustomBarWidth: Story = {
  args: { showChart: true, chartType: 'bar', barWidth: 12 },
};

export const PitWindowOpen: Story = {
  parameters: previewScenario('fuel-pit-window'),
};

export const LowFuel: Story = {
  parameters: previewScenario('fuel-short'),
  args: { fuelLevel: 8.4 },
};

export const TankTooSmall: Story = {
  parameters: previewScenario('fuel-refuel-calc'),
  args: { fuelLevel: 5.2 },
};

export const WithLineChart: Story = {
  args: { showChart: true, chartType: 'line' },
};

export const WithBarChart: Story = {
  args: { showChart: true, chartType: 'bar' },
};

export const NoChart: Story = {
  args: { showChart: false },
};

export const NoData: Story = {
  args: {
    fuelLevel: null,
    avgPerLap: null,
    lapsRemaining: null,
    shortage: null,
    longHistory: false,
  },
};

export const FullPreview: Story = {
  parameters: previewScenario('fuel-refuel-calc'),
  args: { fuelLevel: 5.2, showChart: true, chartType: 'bar' },
};
