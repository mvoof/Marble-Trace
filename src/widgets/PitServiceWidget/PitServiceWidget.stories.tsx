import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ChassisFrame, PitServiceFrame } from '@/types/bindings';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { PitServiceWidget } from './PitServiceWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  speedMs: number;
  pitLimit: string;
  onPitRoad: boolean;
  inPitStall: boolean;
  towTimeS: number;
  fuelOrdered: number;
  fuelCalculated: number;
  repairLeftS: number;
  optRepairLeftS: number;
  changeFronts: boolean;
  changeRears: boolean;
  showFooter: boolean;
}

const CORNER_TEMPS: Record<string, [number, number, number]> = {
  lf: [104, 97, 89],
  rf: [91, 96, 101],
  lr: [95, 92, 87],
  rr: [88, 93, 99],
};

const CORNER_WEAR: Record<string, [number, number, number]> = {
  lf: [0.41, 0.58, 0.72],
  rf: [0.7, 0.61, 0.54],
  lr: [0.62, 0.74, 0.79],
  rr: [0.81, 0.76, 0.64],
};

const CORNER_PRESSURE: Record<string, number> = {
  lf: 152,
  rf: 158,
  lr: 149,
  rr: 154,
};

const buildChassis = (): ChassisFrame => {
  const frame: Record<string, number> = {};

  for (const corner of ['lf', 'rf', 'lr', 'rr']) {
    const [cl, cm, cr] = CORNER_TEMPS[corner];
    const [wl, wm, wr] = CORNER_WEAR[corner];

    frame[`${corner}_temp_cl`] = cl;
    frame[`${corner}_temp_cm`] = cm;
    frame[`${corner}_temp_cr`] = cr;
    frame[`${corner}_wear_l`] = wl;
    frame[`${corner}_wear_m`] = wm;
    frame[`${corner}_wear_r`] = wr;
    frame[`${corner}_pressure`] = CORNER_PRESSURE[corner];
  }

  return frame as unknown as ChassisFrame;
};

const buildPitService = (args: StoryArgs): PitServiceFrame =>
  ({
    flags: null,
    changeLf: args.changeFronts,
    changeRf: args.changeFronts,
    changeLr: args.changeRears,
    changeRr: args.changeRears,
    addFuel: args.fuelOrdered > 0,
    cleanWindshield: false,
    fastRepair: false,
    fuelAmount: args.fuelOrdered,
    lfPressure: 159,
    rfPressure: 163,
    lrPressure: 155,
    rrPressure: 159,
    tireCompound: null,
    repairLeftS: args.repairLeftS,
    optRepairLeftS: args.optRepairLeftS,
    towTimeS: args.towTimeS,
    fastRepairsAvailable: 1,
    fastRepairsUsed: 1,
    serviceStatus: null,
    inPitStall: args.inPitStall,
  }) as PitServiceFrame;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/PitServiceWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: PitServiceWidget,
    size: { width: 300, height: 340 },
    seed: (store, args) => {
      store.player.updateCarStatus({
        on_pit_road: args.onPitRoad,
        fuel_level: 78,
      } as Parameters<typeof store.player.updateCarStatus>[0]);

      store.player.updateCarDynamics({
        speed: args.speedMs,
      } as Parameters<typeof store.player.updateCarDynamics>[0]);

      store.player.updateLapTiming({
        player_car_position: 7,
      } as Parameters<typeof store.player.updateLapTiming>[0]);

      store.player.updateChassis(buildChassis());
      store.player.updatePitService(buildPitService(args));

      store.session.updateSessionInfo({
        trackPitSpeedLimit: args.pitLimit,
      } as Parameters<typeof store.session.updateSessionInfo>[0]);

      store.backendComputed.updateFuel({
        fuelToAdd: args.fuelCalculated,
      } as Parameters<typeof store.backendComputed.updateFuel>[0]);

      store.widgetSettings.updateUserSettings('pit-service', {
        ...store.widgetSettings.getSettings<PitServiceWidgetSettings>(
          'pit-service'
        ),
        showFooter: args.showFooter,
        alwaysVisible: true,
      });
    },
    args: {
      speedMs: 18,
      pitLimit: '72 kph',
      onPitRoad: true,
      inPitStall: false,
      towTimeS: 0,
      fuelOrdered: 34.2,
      fuelCalculated: 34.2,
      repairLeftS: 0,
      optRepairLeftS: 0,
      changeFronts: true,
      changeRears: true,
      showFooter: true,
    },
    argTypes: {
      speedMs: { control: { type: 'range', min: 0, max: 30, step: 0.5 } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Armed: Story = {};

export const OverPitLimit: Story = {
  args: { speedMs: 22 },
};

export const Servicing: Story = {
  args: {
    inPitStall: true,
    speedMs: 0,
    repairLeftS: 12.4,
    optRepairLeftS: 8,
    changeRears: false,
  },
};

export const ManualFuelOrder: Story = {
  args: { fuelOrdered: 40, fuelCalculated: 34.2 },
};

export const Towing: Story = {
  args: { towTimeS: 42, onPitRoad: false },
};

export const FooterOff: Story = {
  args: { showFooter: false },
};
