import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { SpeedWidget } from './SpeedWidget';

const DESIGN_WIDTH = 312;
const DESIGN_HEIGHT = 90;
const BG = 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)';

const meta: Meta<typeof SpeedWidget> = {
  title: 'Widgets/SpeedWidget',
  component: SpeedWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          background: BG,
          overflow: 'visible',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SpeedWidget>;

const withDynamics = (speed: number, rpm: number, gear: number) => ({
  decorators: [
    (Story: React.ComponentType) => {
      runInAction(() => {
        telemetryStore.updateCarDynamics({ speed, rpm, gear } as Parameters<
          typeof telemetryStore.updateCarDynamics
        >[0]);
      });

      return <Story />;
    },
  ],
});

const withPitRoad = (
  speed: number,
  rpm: number,
  gear: number,
  engineWarnings = 0
) => ({
  decorators: [
    (Story: React.ComponentType) => {
      runInAction(() => {
        telemetryStore.updateCarDynamics({ speed, rpm, gear } as Parameters<
          typeof telemetryStore.updateCarDynamics
        >[0]);
        telemetryStore.updateCarStatus({
          on_pit_road: true,
          engine_warnings: engineWarnings,
          oil_temp: null,
          water_temp: null,
        } as Parameters<typeof telemetryStore.updateCarStatus>[0]);
      });

      return <Story />;
    },
  ],
});

export const Default: Story = {
  ...withDynamics(33.3, 5400, 3),
};

export const GearFocus: Story = {
  ...withDynamics(61.9, 7800, 5),
};

export const HighRpm: Story = {
  ...withDynamics(61.9, 7800, 5),
};

export const OnPitRoad: Story = {
  ...withPitRoad(12.5, 2800, 2),
};

export const PitLimiterActive: Story = {
  ...withPitRoad(16.67, 3100, 3, 0x10),
};

export const OverPitLimit: Story = {
  ...withPitRoad(18.5, 3400, 3, 0x10),
};

export const WithTemps: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      runInAction(() => {
        telemetryStore.updateCarDynamics({
          speed: 33.3,
          rpm: 5400,
          gear: 3,
        } as Parameters<typeof telemetryStore.updateCarDynamics>[0]);
        telemetryStore.updateCarStatus({
          on_pit_road: false,
          engine_warnings: 0,
          oil_temp: 92,
          water_temp: 88,
        } as Parameters<typeof telemetryStore.updateCarStatus>[0]);
      });

      return <Story />;
    },
  ],
};

export const TempWarning: Story = {
  decorators: [
    (Story: React.ComponentType) => {
      runInAction(() => {
        telemetryStore.updateCarDynamics({
          speed: 33.3,
          rpm: 5400,
          gear: 3,
        } as Parameters<typeof telemetryStore.updateCarDynamics>[0]);
        telemetryStore.updateCarStatus({
          on_pit_road: false,
          engine_warnings: 0,
          oil_temp: 135,
          water_temp: 132,
        } as Parameters<typeof telemetryStore.updateCarStatus>[0]);
      });

      return <Story />;
    },
  ],
};

export const NoRpmBar: Story = {
  ...withDynamics(33.3, 5400, 3),
};
