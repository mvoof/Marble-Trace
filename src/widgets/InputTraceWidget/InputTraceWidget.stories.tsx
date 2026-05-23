import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { CarInputsFrame } from '@/types/bindings';
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

const applyArgs = (
  stores: { telemetry: TelemetryStore; widgetSettings: WidgetSettingsStore },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('input-trace', {
      barMode: args.barMode,
      showThrottle: args.showThrottle,
      showBrake: args.showBrake,
      showClutch: args.showClutch,
    });

    stores.telemetry.updateCarInputs({
      throttle: args.throttle,
      brake: args.brake,
      clutch: 1 - args.clutch,
    } as CarInputsFrame);
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

export const HorizontalBars: Story = {
  args: { barMode: 'horizontal', throttle: 0.8, brake: 0.2 },
};

export const FullInputs: Story = {
  args: { throttle: 0.0, brake: 1.0, clutch: 0.5 },
};

export const OnlyBrake: Story = {
  args: { showThrottle: false, showClutch: false, brake: 0.7 },
};
