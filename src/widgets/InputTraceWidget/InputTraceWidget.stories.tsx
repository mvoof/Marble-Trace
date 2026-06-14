import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CarDynamicsFrame, CarInputsFrame } from '@/types/bindings';
import type { InputTraceSettings } from '@/types/widget-settings';
import { InputTraceWidget } from './InputTraceWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  throttle: number;
  brake: number;
  clutch: number;
  showThrottle: boolean;
  showBrake: boolean;
  showClutch: boolean;
  showSteering: boolean;
  showTrace: boolean;
  steeringWheelAngle: number;
  steeringLimit: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/InputTraceWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: InputTraceWidget,
    size: {
      width: 520,
      height: 120,
      borderRadius: '12px 9999px 9999px 12px',
    },
    seedSnapshot: true,
    seed: (store, args) => {
      store.widgetSettings.updateUserSettings('input-trace', {
        showThrottle: args.showThrottle,
        showBrake: args.showBrake,
        showClutch: args.showClutch,
        showSteering: args.showSteering,
        showTrace: args.showTrace,
        steeringLimit: args.steeringLimit,
      } as Partial<InputTraceSettings>);

      store.player.updateCarInputs({
        throttle: args.throttle,
        brake: args.brake,
        clutch: 1 - args.clutch,
        brake_abs_active: false,
      } as CarInputsFrame);

      store.player.updateCarDynamics({
        steering_wheel_angle: args.steeringWheelAngle,
        speed: 0,
        rpm: 0,
        gear: 0,
        velocity_x: null,
        velocity_y: null,
        velocity_z: null,
        lat_accel: null,
        long_accel: null,
        yaw_rate: null,
        pitch: null,
        roll: null,
        yaw: null,
        shift_indicator_pct: null,
        shift_grind_rpm: null,
      } as CarDynamicsFrame);
    },
    args: {
      throttle: 0.6,
      brake: 0,
      clutch: 0,
      showThrottle: true,
      showBrake: true,
      showClutch: true,
      showSteering: true,
      showTrace: true,
      steeringWheelAngle: 0.5,
      steeringLimit: 900,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const NoTrace: Story = {
  args: { showTrace: false },
};

export const FullThrottle: Story = {
  args: { throttle: 1.0 },
};

export const HeavyBraking: Story = {
  args: { throttle: 0, brake: 0.95 },
};

export const TrailBraking: Story = {
  args: { throttle: 0.3, brake: 0.5 },
};

export const OnlyThrottleBrake: Story = {
  args: { throttle: 0.7, showClutch: false },
};

export const FullInputs: Story = {
  args: { throttle: 0.0, brake: 1.0, clutch: 0.5 },
};

export const OnlyBrake: Story = {
  args: { showThrottle: false, showClutch: false, brake: 0.7 },
};

export const SteeringLeft: Story = {
  args: { steeringWheelAngle: 1.5 },
};

export const SteeringRight: Story = {
  args: { steeringWheelAngle: -1.5 },
};
