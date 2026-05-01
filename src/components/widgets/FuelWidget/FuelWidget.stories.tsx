import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FuelWidget } from './FuelWidget';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 360;

const wrap = (props: ComponentProps<typeof FuelWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
        overflow: 'hidden',
      }}
    >
      <FuelWidget {...props} />
    </div>
  </div>
);

const meta: Meta<typeof FuelWidget> = {
  title: 'Widgets/FuelWidget',
  component: FuelWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof FuelWidget>;

export const Default: Story = {
  args: {
    fuelLevel: 57.6,
    fuelMax: 70,
    avgPerLap: 2.35,
    lapsRemaining: 18.3,
    lapsToFinish: 15,
    shortage: 7.8,
    fuelToAddWithBuffer: 0,
    fuelSavePerLap: null,
    pitWarning: false,
    pitWindowStart: null,
    pitWindowEnd: null,
    showChart: false,
    chartType: 'bar',
    lapFuelHistory: [],
  },
};

export const ShortFuel: Story = {
  args: {
    fuelLevel: 23.9,
    fuelMax: 70,
    avgPerLap: 2.35,
    lapsRemaining: 10.2,
    lapsToFinish: 15,
    shortage: -11.28,
    fuelToAddWithBuffer: 13.63,
    fuelSavePerLap: 0.75,
    pitWarning: true,
    pitWindowStart: 29,
    pitWindowEnd: 31,
    showChart: false,
    chartType: 'bar',
    lapFuelHistory: [],
  },
};

export const PitWarning: Story = {
  args: {
    fuelLevel: 30.4,
    fuelMax: 70,
    avgPerLap: 2.1,
    lapsRemaining: 14.5,
    lapsToFinish: 13,
    shortage: 3.15,
    fuelToAddWithBuffer: 2.1,
    fuelSavePerLap: null,
    pitWarning: true,
    pitWindowStart: 34,
    pitWindowEnd: 36,
    showChart: false,
    chartType: 'bar',
    lapFuelHistory: [],
  },
};

export const WithBarChart: Story = {
  args: {
    fuelLevel: 35.0,
    fuelMax: 70,
    avgPerLap: 2.18,
    lapsRemaining: 16.1,
    lapsToFinish: 14,
    shortage: 4.48,
    fuelToAddWithBuffer: 0,
    fuelSavePerLap: null,
    pitWarning: false,
    pitWindowStart: null,
    pitWindowEnd: null,
    showChart: true,
    chartType: 'bar',
    lapFuelHistory: [2.3, 2.1, 2.25, 2.15, 2.2, 2.18, 2.22, 2.14],
  },
};

export const WithLineChart: Story = {
  args: {
    fuelLevel: 35.0,
    fuelMax: 70,
    avgPerLap: 2.18,
    lapsRemaining: 16.1,
    lapsToFinish: 14,
    shortage: 4.48,
    fuelToAddWithBuffer: 0,
    fuelSavePerLap: null,
    pitWarning: false,
    pitWindowStart: null,
    pitWindowEnd: null,
    showChart: true,
    chartType: 'line',
    lapFuelHistory: [2.3, 2.1, 2.25, 2.15, 2.2, 2.18, 2.22, 2.14],
  },
};

export const ShortFuelWithChart: Story = {
  args: {
    fuelLevel: 18.5,
    fuelMax: 70,
    avgPerLap: 2.35,
    lapsRemaining: 7.9,
    lapsToFinish: 15,
    shortage: -16.75,
    fuelToAddWithBuffer: 19.1,
    fuelSavePerLap: 1.12,
    pitWarning: true,
    pitWindowStart: 27,
    pitWindowEnd: 29,
    showChart: true,
    chartType: 'bar',
    lapFuelHistory: [2.3, 2.1, 2.25, 2.15, 2.2, 2.38, 2.42, 2.35],
  },
};

export const NoData: Story = {
  args: {
    fuelLevel: null,
    fuelMax: null,
    avgPerLap: null,
    lapsRemaining: null,
    lapsToFinish: null,
    shortage: null,
    fuelToAddWithBuffer: null,
    fuelSavePerLap: null,
    pitWarning: false,
    pitWindowStart: null,
    pitWindowEnd: null,
    showChart: false,
    chartType: 'bar',
    lapFuelHistory: [],
  },
};
