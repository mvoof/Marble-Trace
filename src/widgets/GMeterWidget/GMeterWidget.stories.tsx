import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type {
  GMeterColorMode,
  GMeterDisplayMode,
} from '@/types/widget-settings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { GMeterWidget } from './GMeterWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const G_CONSTANT = 9.80665;

interface StoryArgs {
  displayMode: GMeterDisplayMode;
  scale: 2 | 3 | 4 | 5;
  colorMode: GMeterColorMode;
  latG: number;
  longG: number;
}

const applyArgs = (
  stores: { telemetry: TelemetryStore; widgetSettings: WidgetSettingsStore },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.telemetry.updateCarDynamics({
      lat_accel: args.latG * G_CONSTANT,
      long_accel: args.longG * G_CONSTANT,
    } as Parameters<typeof stores.telemetry.updateCarDynamics>[0]);

    stores.widgetSettings.updateUserSettings('g-meter', {
      displayMode: args.displayMode,
      scale: args.scale,
      colorMode: args.colorMode,
    });
  });
};

const StoryHost = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ telemetry, widgetSettings }, args);
  }, [args, telemetry, widgetSettings]);

  return <GMeterWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/GMeter',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({
      width: 240,
      height: 280,
      background: 'rgba(21, 22, 26, 0.8)',
    }),
  ],
  args: {
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
    latG: 0,
    longG: 0,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Idle: Story = {};

export const HighSpeedCorner: Story = {
  args: { latG: 2.8, longG: -0.3 },
};

export const HeavyBraking: Story = {
  args: { latG: 0.1, longG: -3.1 },
};

export const HardAcceleration: Story = {
  args: { latG: -0.2, longG: 1.8 },
};

export const TrailMono: Story = {
  args: {
    displayMode: 'trail',
    scale: 3,
    colorMode: 'mono',
    latG: 2.1,
    longG: -1.2,
  },
};

export const PeakSimple: Story = {
  args: {
    displayMode: 'peak',
    scale: 2,
    colorMode: 'simple',
    latG: 1.9,
    longG: -2.5,
  },
};

export const FadingAdvanced: Story = {
  args: {
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
    latG: -2.6,
    longG: 0.8,
  },
};
