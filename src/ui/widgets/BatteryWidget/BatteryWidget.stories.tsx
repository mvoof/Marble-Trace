import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  mockCarStatus,
  mockHybridCarStatus,
} from '@store/preview/mocks/engine';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { BatteryWidget } from './BatteryWidget';

interface StoryArgs {
  /** State of charge, 0 to 1 — the bar changes colour across it. */
  charge: number;
  /** MGU-K power in watts. Negative harvests, positive deploys. */
  powerWatts: number;
  /**
   * The selector position. Out of range stands for a car that parks the field
   * on a value it never moves, which hides the strip.
   */
  deployMode: number;
  /** No hybrid system at all — the widget renders nothing. */
  noHybrid: boolean;

  showDeployMode: boolean;
  showPower: boolean;
  showLapDeploy: boolean;
  compactMode: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/BatteryWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: BatteryWidget,
    size: { width: 280, height: 120 },
    seed: (store, args) => {
      store.player.updateCarStatus(
        args.noHybrid
          ? mockCarStatus()
          : mockHybridCarStatus({
              energy_ers_battery_pct: args.charge,
              power_mgu_k: args.powerWatts,
              dc_mguk_deploy_mode: args.deployMode,
            })
      );

      store.liveWidgets.updateUserSettings('battery', {
        showDeployMode: args.showDeployMode,
        showPower: args.showPower,
        showLapDeploy: args.showLapDeploy,
        compactMode: args.compactMode,
      });
    },
    args: {
      charge: 0.9,
      powerWatts: 102_556,
      deployMode: 1,
      noHybrid: false,

      showDeployMode: true,
      showPower: true,
      showLapDeploy: false,
      compactMode: false,
    },
    argTypes: {
      charge: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
      powerWatts: {
        control: { type: 'range', min: -250_000, max: 150_000, step: 1_000 },
      },
      deployMode: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Deploying: Story = {};

export const Harvesting: Story = {
  args: {
    charge: 0.41,
    powerWatts: -211_110,
  },
};

/** Inside the dead band, where the sign of the power is noise. */
export const Coasting: Story = {
  args: {
    powerWatts: 120,
  },
};

export const ChargeLow: Story = {
  args: {
    charge: 0.34,
  },
};

export const ChargeCritical: Story = {
  args: {
    charge: 0.08,
    powerWatts: -180_000,
  },
};

/** A GTP car: the field is parked on a value the driver cannot move. */
export const NoModeSelector: Story = {
  args: {
    deployMode: 7,
  },
};

export const WithLapDeploy: Story = {
  args: {
    showLapDeploy: true,
  },
};

/** Charge bar and percentage only — every other row hidden. */
export const Compact: Story = {
  args: {
    compactMode: true,
  },
};

/** A GT3. Nothing renders, which is the point. */
export const NoHybridSystem: Story = {
  args: {
    noHybrid: true,
  },
};
