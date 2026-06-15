import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ChassisFrame } from '@/types/bindings';
import type { ChassisWidgetSettings } from '@/types/widget-settings';
import { ChassisWidget } from './ChassisWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

// All pressure values in kPa, ride heights / shock deflections in meters, temps in °C

interface CornerSeed {
  tempL: number | null;
  tempM: number | null;
  tempR: number | null;
  pressureKpa: number | null;
  wearL: number | null;
  wearM: number | null;
  wearR: number | null;
  rideHeightM: number | null;
  shockDeflM: number | null;
  brakeTemp: number | null;
}

interface StoryArgs {
  lf: CornerSeed;
  rf: CornerSeed;
  lr: CornerSeed;
  rr: CornerSeed;
  onPitRoad: boolean;
  showSuspensionAndBrakes: boolean;
}

const makeCorner = (overrides: Partial<CornerSeed> = {}): CornerSeed => ({
  tempL: 82,
  tempM: 88,
  tempR: 84,
  pressureKpa: 180,
  wearL: 0.85,
  wearM: 0.8,
  wearR: 0.78,
  rideHeightM: 0.042,
  shockDeflM: 0.012,
  brakeTemp: 320,
  ...overrides,
});

const makeDisconnectedCorner = (): CornerSeed => ({
  tempL: null,
  tempM: null,
  tempR: null,
  pressureKpa: null,
  wearL: null,
  wearM: null,
  wearR: null,
  rideHeightM: null,
  shockDeflM: null,
  brakeTemp: null,
});

const buildChassisFrame = (args: StoryArgs): ChassisFrame => ({
  lf_temp_cl: args.lf.tempL,
  lf_temp_cm: args.lf.tempM,
  lf_temp_cr: args.lf.tempR,
  rf_temp_cl: args.rf.tempL,
  rf_temp_cm: args.rf.tempM,
  rf_temp_cr: args.rf.tempR,
  lr_temp_cl: args.lr.tempL,
  lr_temp_cm: args.lr.tempM,
  lr_temp_cr: args.lr.tempR,
  rr_temp_cl: args.rr.tempL,
  rr_temp_cm: args.rr.tempM,
  rr_temp_cr: args.rr.tempR,
  lf_pressure: args.lf.pressureKpa,
  rf_pressure: args.rf.pressureKpa,
  lr_pressure: args.lr.pressureKpa,
  rr_pressure: args.rr.pressureKpa,
  lf_wear_l: args.lf.wearL,
  lf_wear_m: args.lf.wearM,
  lf_wear_r: args.lf.wearR,
  rf_wear_l: args.rf.wearL,
  rf_wear_m: args.rf.wearM,
  rf_wear_r: args.rf.wearR,
  lr_wear_l: args.lr.wearL,
  lr_wear_m: args.lr.wearM,
  lr_wear_r: args.lr.wearR,
  rr_wear_l: args.rr.wearL,
  rr_wear_m: args.rr.wearM,
  rr_wear_r: args.rr.wearR,
  lf_ride_height: args.lf.rideHeightM,
  rf_ride_height: args.rf.rideHeightM,
  lr_ride_height: args.lr.rideHeightM,
  rr_ride_height: args.rr.rideHeightM,
  lf_shock_defl: args.lf.shockDeflM,
  rf_shock_defl: args.rf.shockDeflM,
  lr_shock_defl: args.lr.shockDeflM,
  rr_shock_defl: args.rr.shockDeflM,
  lf_brake_temp: args.lf.brakeTemp,
  rf_brake_temp: args.rf.brakeTemp,
  lr_brake_temp: args.lr.brakeTemp,
  rr_brake_temp: args.rr.brakeTemp,
});

const SUSPENSION_FRAME = { widgetFrame: { width: 400, height: 290 } };

const meta: Meta<StoryArgs> = {
  title: 'Widgets/ChassisWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: ChassisWidget,
    size: { width: 280, height: 290 },
    seed: (store, args) => {
      store.player.updateChassis(buildChassisFrame(args));

      store.player.updateCarStatus({
        on_pit_road: args.onPitRoad,
      } as Parameters<typeof store.player.updateCarStatus>[0]);

      store.widgetSettings.updateUserSettings('chassis', {
        ...store.widgetSettings.getSettings<ChassisWidgetSettings>('chassis'),
        showSuspensionAndBrakes: args.showSuspensionAndBrakes,
      });
    },
    args: {
      lf: makeCorner(),
      rf: makeCorner(),
      lr: makeCorner({ wearL: 0.7, wearM: 0.72, wearR: 0.68 }),
      rr: makeCorner({ wearL: 0.7, wearM: 0.72, wearR: 0.68 }),
      onPitRoad: true,
      showSuspensionAndBrakes: false,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Disconnected: Story = {
  args: {
    lf: makeDisconnectedCorner(),
    rf: makeDisconnectedCorner(),
    lr: makeDisconnectedCorner(),
    rr: makeDisconnectedCorner(),
    onPitRoad: true,
  },
};

export const OnPitRoad: Story = {
  args: { onPitRoad: true },
};

export const WithSuspensionAndBrakes: Story = {
  args: { showSuspensionAndBrakes: true, onPitRoad: true },
  parameters: SUSPENSION_FRAME,
};

export const Punctured: Story = {
  args: { lf: makeCorner({ pressureKpa: 30 }), onPitRoad: true },
};

export const BrakeOverheat: Story = {
  args: {
    lf: makeCorner({ brakeTemp: 900 }),
    rf: makeCorner({ brakeTemp: 870 }),
    onPitRoad: true,
  },
};

export const HotTires: Story = {
  args: {
    lf: makeCorner({ tempL: 130, tempM: 138, tempR: 132 }),
    rf: makeCorner({ tempL: 128, tempM: 135, tempR: 130 }),
    onPitRoad: true,
  },
};

export const ColdTires: Story = {
  args: {
    lf: makeCorner({ tempL: 40, tempM: 42, tempR: 41 }),
    rf: makeCorner({ tempL: 38, tempM: 41, tempR: 40 }),
    lr: makeCorner({ tempL: 36, tempM: 39, tempR: 37 }),
    rr: makeCorner({ tempL: 35, tempM: 38, tempR: 36 }),
    onPitRoad: true,
  },
};

export const UnevenWear: Story = {
  args: {
    lf: makeCorner({ wearL: 0.45, wearM: 0.6, wearR: 0.72 }),
    rf: makeCorner({ wearL: 0.71, wearM: 0.58, wearR: 0.44 }),
    onPitRoad: true,
  },
};

export const FullSuspensionData: Story = {
  parameters: SUSPENSION_FRAME,
  args: {
    showSuspensionAndBrakes: true,
    onPitRoad: true,
    lf: makeCorner({ rideHeightM: 0.028, shockDeflM: 0.018, brakeTemp: 450 }),
    rf: makeCorner({ rideHeightM: 0.031, shockDeflM: 0.016, brakeTemp: 420 }),
    lr: makeCorner({ rideHeightM: 0.055, shockDeflM: 0.01, brakeTemp: 280 }),
    rr: makeCorner({ rideHeightM: 0.058, shockDeflM: 0.009, brakeTemp: 260 }),
  },
};
