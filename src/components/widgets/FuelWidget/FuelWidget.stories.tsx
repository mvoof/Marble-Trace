import type { Meta, StoryObj } from '@storybook/react-vite';

import { FuelWidget } from './FuelWidget';

const LAP_FUEL_HISTORY = [3.2, 3.1, 3.3, 3.0, 3.2, 3.1, 3.4, 3.0];

const meta: Meta<typeof FuelWidget> = {
  title: 'Widgets/FuelWidget',
  component: FuelWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 280,
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
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
    tankTooSmall: false,
    showChart: false,
    chartType: 'line',
    lapFuelHistory: LAP_FUEL_HISTORY,
    pitWarningLaps: 3,
  },
};

export default meta;
type Story = StoryObj<typeof FuelWidget>;

export const Comfortable: Story = {};

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
    tankTooSmall: true,
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
  args: {
    showChart: true,
    chartType: 'bar',
    lapFuelHistory: LAP_FUEL_HISTORY,
  },
};

export const NoChart: Story = {
  args: {
    showChart: false,
  },
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
