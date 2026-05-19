import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type { CarInputsFrame } from '../../../types/bindings';
import type { InputTraceSettings } from '../../../types/widget-settings';
import { InputTraceWidget } from './InputTraceWidget';
import { widgetDecorator } from '../../../stories/widgetDecorator';

const DESIGN_WIDTH = 500;
const DESIGN_HEIGHT = 120;

interface StoryArgs {
  throttle: number;
  brake: number;
  clutch: number;
  barMode: InputTraceSettings['barMode'];
  showThrottle: boolean;
  showBrake: boolean;
  showClutch: boolean;
}

const applyArgs = (args: StoryArgs) => {
  runInAction(() => {
    widgetSettingsStore.updateUserSettings('input-trace', {
      barMode: args.barMode,
      showThrottle: args.showThrottle,
      showBrake: args.showBrake,
      showClutch: args.showClutch,
    });

    telemetryStore.updateCarInputs({
      throttle: args.throttle,
      brake: args.brake,
      clutch: 1 - args.clutch,
    } as CarInputsFrame);
  });
};

const StoryHost = (args: StoryArgs) => {
  useEffect(() => {
    applyArgs(args);
  }, [args]);

  return <InputTraceWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/InputTraceWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT })],
  args: {
    throttle: 0.6,
    brake: 0,
    clutch: 0,
    barMode: 'vertical',
    showThrottle: true,
    showBrake: true,
    showClutch: true,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const HiddenBars: Story = {
  args: { barMode: 'hidden' },
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
