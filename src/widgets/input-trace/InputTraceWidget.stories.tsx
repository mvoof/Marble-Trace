import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  mockCornerSpeeds,
  type CornerProgress,
} from '@features/preview/mocks/corner-speeds';
import { mockCarDynamics } from '@features/preview/mocks/dynamics';
import { mockCarInputs } from '@features/preview/mocks/inputs';
import { seedInputHistory } from '@features/preview/preview-animator';
import { InputTraceWidget } from './InputTraceWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { withReplay } from '@/storybook/with-replay';
import type { InputTraceSettings } from './settings-schema';

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
  cornerProgress: CornerProgress;
  rpm: number;
  gear: number;
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
        mockCarDynamics({
          steering_wheel_angle: args.steeringWheelAngle,
          rpm: args.rpm,
          gear: args.gear,
        })
      );

      store.backendComputed.updateCornerSpeeds(
        mockCornerSpeeds(args.cornerProgress)
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
      cornerProgress: 'exited',
      rpm: 6400,
      gear: 4,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

/** A few seconds of throttle and brake already drawn, as on the site. */
export const Showcase: Story = {
  args: {
    steeringCenterDisplay: 'speed-gear',
    steeringWheelStyle: 'formula-conspit',
  },

  decorators: [withReplay(seedInputHistory)],
};

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

/** The corner speeds beside the wheel: the corner just left, all three lit. */
export const CornerSpeeds: Story = {
  args: { showCornerSpeeds: true },
};

/** On the approach: the reference lap's three figures, dimmed. */
export const CornerSpeedsApproach: Story = {
  args: { showCornerSpeeds: true, cornerProgress: 'approach' },
};

/** Past the brake point: the entry lit, the apex and exit still targets. */
export const CornerSpeedsBraking: Story = {
  args: { showCornerSpeeds: true, cornerProgress: 'braking' },
};

/** The speed and gear as a block of their own, beside the wheel. */
export const SpeedGear: Story = {
  args: { showSpeedGear: true },
};

/** Corner speeds, speed and gear, no wheel: the plate's right edge goes straight. */
export const CornerSpeedsWithoutWheel: Story = {
  args: { showCornerSpeeds: true, showSpeedGear: true, showSteering: false },
};

/** At the shift point: the gear in the zone colour, flashing. */
export const GearAtShiftPoint: Story = {
  args: {
    showSpeedGear: true,
    colorizeGearByZone: true,
    blinkAtShift: true,
    rpm: 9200,
    gear: 2,
  },
};
