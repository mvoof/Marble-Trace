import type { Meta, StoryObj } from '@storybook/react-vite';

import type { InputTraceSettings } from '@/types/widget-settings';
import { mockCarDynamics } from '@store/preview/mocks/dynamics';
import { mockCarInputs } from '@store/preview/mocks/inputs';
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
  steeringLock: number;
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
      const settings: Partial<InputTraceSettings> = {
        showThrottle: args.showThrottle,
        showBrake: args.showBrake,
        showClutch: args.showClutch,
        showSteering: args.showSteering,
        showTrace: args.showTrace,
      };

      store.liveWidgets.updateUserSettings('input-trace', settings);

      store.appSettings.setSteeringLock(args.steeringLock);

      store.player.updateCarInputs(
        mockCarInputs({
          throttle: args.throttle,
          brake: args.brake,
          // The sim reports the clutch the other way up: fully engaged is 1.
          clutch: 1 - args.clutch,
          brake_abs_active: false,
        })
      );

      store.player.updateCarDynamics(
        mockCarDynamics({ steering_wheel_angle: args.steeringWheelAngle })
      );
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
      steeringLock: 900,
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
