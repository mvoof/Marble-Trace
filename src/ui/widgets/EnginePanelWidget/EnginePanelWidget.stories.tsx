import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CarInputsFrame, CarStatusFrame } from '@/types/bindings';
import type { UnitSystem } from '@/types';
import { EnginePanelWidget } from './EnginePanelWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  system: UnitSystem;
  oilTemp: number;
  waterTemp: number;
  oilPress: number;
  voltage: number;
  dcAbs: number;
  dcBrakeBias: number;
  dcTc: number;
  dcThrottleShape: number;
  absActive: boolean;

  showOilTemp: boolean;
  showWaterTemp: boolean;
  showOilPress: boolean;
  showVoltage: boolean;
  showAbs: boolean;
  showTc: boolean;
  showBrakeBias: boolean;
  showEngineMap: boolean;
  horizontal: boolean;
  verticalColumns: number;
  horizontalColumns: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/EnginePanelWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: EnginePanelWidget,
    size: { width: 480, height: 80 },
    seedSnapshot: true,
    seed: (store, args) => {
      store.units.setSystem(args.system);

      store.player.updateCarInputs({
        brake_abs_active: args.absActive,
      } as CarInputsFrame);

      store.player.updateCarStatus({
        oil_temp: args.oilTemp,
        water_temp: args.waterTemp,
        oil_press: args.oilPress,
        voltage: args.voltage,
        dc_abs: args.dcAbs,
        dc_brake_bias: args.dcBrakeBias,
        dc_traction_control: args.dcTc,
        dc_throttle_shape: args.dcThrottleShape,
      } as CarStatusFrame);

      store.widgetSettings.updateUserSettings('engine-panel', {
        showOilTemp: args.showOilTemp,
        showWaterTemp: args.showWaterTemp,
        showOilPress: args.showOilPress,
        showVoltage: args.showVoltage,
        showAbs: args.showAbs,
        showTc: args.showTc,
        showBrakeBias: args.showBrakeBias,
        showEngineMap: args.showEngineMap,
        horizontal: args.horizontal,
        verticalColumns: args.verticalColumns,
        horizontalColumns: args.horizontalColumns,
      });
    },
    args: {
      system: 'metric',
      oilTemp: 110,
      waterTemp: 90,
      oilPress: 350,
      voltage: 14.2,
      dcAbs: 3,
      dcBrakeBias: 54.5,
      dcTc: 5,
      dcThrottleShape: 2,
      absActive: false,

      showOilTemp: true,
      showWaterTemp: true,
      showOilPress: true,
      showVoltage: true,
      showAbs: true,
      showTc: true,
      showBrakeBias: true,
      showEngineMap: true,
      horizontal: true,
      verticalColumns: 2,
      horizontalColumns: 8,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Imperial: Story = {
  args: {
    system: 'imperial',
  },
};

export const ABSActive: Story = {
  args: {
    absActive: true,
  },
};

export const OverheatingAlerts: Story = {
  args: {
    oilTemp: 138,
    waterTemp: 122,
    oilPress: 280,
  },
};

export const MinimalLayout: Story = {
  args: {
    showOilPress: false,
    showVoltage: false,
    showEngineMap: false,
  },
};

export const Vertical1Col: Story = {
  args: {
    horizontal: false,
    verticalColumns: 1,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '120px', height: '480px' }}>
        <Story />
      </div>
    ),
  ],
};

export const Vertical2Cols: Story = {
  args: {
    horizontal: false,
    verticalColumns: 2,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '240px', height: '240px' }}>
        <Story />
      </div>
    ),
  ],
};

export const Vertical3Cols: Story = {
  args: {
    horizontal: false,
    verticalColumns: 3,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px', height: '160px' }}>
        <Story />
      </div>
    ),
  ],
};
