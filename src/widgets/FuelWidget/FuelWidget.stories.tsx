import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FuelComputedFrame } from '@/types/bindings';
import type { FuelWidgetSettings } from '@/types/widget-settings';
import { FuelWidget } from './FuelWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const LAP_FUEL_HISTORY = [
  3.2, 3.1, 3.3, 3, 3.2, 3.1, 3.4, 3, 2, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3,
  3, 4, 3.2, 3.5, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3.2, 3.5, 2, 3.2,
  3.1, 3.3, 3, 3.2, 3.1, 3.4, 3, 2, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4,
  3.2, 3.5, 5, 3, 3, 30, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3.2, 3.5, 2, 3.2, 3.1,
  6, 3.3, 3, 3.2, 3.1, 3.4, 3, 2, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4,
  3.2, 3.5, 5, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3.2, 3.5, 2, 5, 3, 4,
];

interface StoryArgs {
  fuelLevel: number | null;
  fuelMax: number | null;
  avgPerLap: number | null;
  lapsRemaining: number | null;
  shortage: number | null;
  fuelToAddWithBuffer: number | null;
  pitWarning: boolean;
  pitWindowStart: number | null;
  pitWindowEnd: number | null;
  showChart: boolean;
  chartType: 'line' | 'bar';
  barWidth: number;
  lapFuelHistory: number[];
  pitWarningLaps: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/FuelWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: FuelWidget,
    size: { width: 240, height: 360 },
    seed: (store, args) => {
      store.player.updateCarStatus({
        fuel_level: args.fuelLevel,
      } as Parameters<typeof store.player.updateCarStatus>[0]);

      store.session.updateSessionInfo({
        driverCarFuelMaxLtr: args.fuelMax,
      } as Parameters<typeof store.session.updateSessionInfo>[0]);

      store.backendComputed.updateFuel({
        avgPerLap: args.avgPerLap,
        lapsRemaining: args.lapsRemaining,
        lapsToFinish: args.lapsRemaining,
        shortage: args.shortage,
        fuelToAdd: args.fuelToAddWithBuffer,
        fuelToAddWithBuffer: args.fuelToAddWithBuffer,
        fuelSavePerLap: null,
        pitWarning: args.pitWarning,
        pitWindowStart: args.pitWindowStart,
        pitWindowEnd: args.pitWindowEnd,
        isTimedRace: false,
        lapFuelHistory: args.lapFuelHistory,
      } as FuelComputedFrame);

      store.widgetSettings.updateUserSettings('fuel', {
        ...store.widgetSettings.getSettings<FuelWidgetSettings>('fuel'),
        showChart: args.showChart,
        chartType: args.chartType,
        barWidth: args.barWidth,
        pitWarningLaps: args.pitWarningLaps,
      });
    },
    args: {
      fuelLevel: 28.5,
      fuelMax: 55.0,
      avgPerLap: 3.15,
      lapsRemaining: 9.0,
      shortage: 2.3,
      fuelToAddWithBuffer: null,
      pitWarning: false,
      pitWindowStart: null,
      pitWindowEnd: null,
      showChart: false,
      chartType: 'line',
      barWidth: 5,
      lapFuelHistory: LAP_FUEL_HISTORY,
      pitWarningLaps: 3,
    },
    argTypes: {
      barWidth: { control: { type: 'range', min: 5, max: 20, step: 1 } },
      chartType: { control: 'inline-radio', options: ['line', 'bar'] },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Comfortable: Story = {};

export const CustomBarWidth: Story = {
  args: { showChart: true, chartType: 'bar', barWidth: 12 },
};

export const LowFuel: Story = {
  args: {
    fuelLevel: 8.4,
    lapsRemaining: 2.7,
    shortage: -1.2,
    pitWarning: true,
    pitWindowStart: 14,
    pitWindowEnd: 16,
    fuelToAddWithBuffer: 12.5,
  },
};

export const TankTooSmall: Story = {
  args: {
    fuelLevel: 5.2,
    lapsRemaining: 1.6,
    shortage: -5.8,
    pitWarning: true,
    pitWindowStart: 12,
    pitWindowEnd: 13,
    fuelToAddWithBuffer: 58.0,
  },
};

export const WithLineChart: Story = {
  args: {
    showChart: true,
    chartType: 'line',
    lapFuelHistory: LAP_FUEL_HISTORY,
  },
};

export const WithBarChart: Story = {
  args: { showChart: true, chartType: 'bar', lapFuelHistory: LAP_FUEL_HISTORY },
};

export const NoChart: Story = {
  args: { showChart: false },
};

export const NoData: Story = {
  args: {
    fuelLevel: null,
    fuelMax: null,
    avgPerLap: null,
    lapsRemaining: null,
    shortage: null,
    lapFuelHistory: [],
  },
};

export const FullPreview: Story = {
  args: {
    fuelLevel: 5.2,
    fuelMax: 55.0,
    avgPerLap: 3.15,
    lapsRemaining: 1.6,
    shortage: -15.8,
    pitWarning: true,
    pitWindowStart: 12,
    pitWindowEnd: 13,
    fuelToAddWithBuffer: 58.0,
    showChart: true,
    chartType: 'bar',
    lapFuelHistory: LAP_FUEL_HISTORY,
  },
};
