import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { CarDynamicsFrame, CarInputsFrame } from '@/types/bindings';
import type { InputTraceSettings } from '@/types/widget-settings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { InputTraceWidget } from './InputTraceWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

const DESIGN_WIDTH = 620;
const DESIGN_HEIGHT = 220;

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

const applyArgs = (
  stores: { telemetry: TelemetryStore; widgetSettings: WidgetSettingsStore },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('input-trace', {
      showThrottle: args.showThrottle,
      showBrake: args.showBrake,
      showClutch: args.showClutch,
      showSteering: args.showSteering,
      showTrace: args.showTrace,
      steeringLimit: args.steeringLimit,
    } as Partial<InputTraceSettings>);

    stores.telemetry.updateCarInputs({
      throttle: args.throttle,
      brake: args.brake,
      clutch: 1 - args.clutch,
      brake_abs_active: false,
    } as CarInputsFrame);

    stores.telemetry.updateCarDynamics({
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
  });
};

const StoryHost = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ telemetry, widgetSettings }, args);
  }, [args, telemetry, widgetSettings]);

  return <InputTraceWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/InputTraceWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(seedFromSnapshot),
    widgetDecorator({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }),
  ],
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
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

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
