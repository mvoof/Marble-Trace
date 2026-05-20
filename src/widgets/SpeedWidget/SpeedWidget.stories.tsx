import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { SessionInfo } from '@/types/bindings';
import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { unitsStore } from '@store/units.store';
import { SpeedWidget } from './SpeedWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';

const DESIGN_WIDTH = 500;
const DESIGN_HEIGHT = 120;
const BG = 'radial-gradient(circle, #252525 0%, #14141b 100%)';

const RED_LINE = 8500;
const SHIFT_RPM = 8000;
const BLINK_RPM = 8200;

const BASE_SESSION_INFO = {
  DriverInfo: {
    DriverCarRedLine: RED_LINE,
    DriverCarSLShiftRPM: SHIFT_RPM,
    DriverCarSLBlinkRPM: BLINK_RPM,
  },
  WeekendInfo: {
    TrackPitSpeedLimit: '55 kph',
  },
} as SessionInfo;

interface StoryArgs {
  speedKmh: number;
  rpm: number;
  gear: number;
  onPitRoad: boolean;
  engineWarnings: number;
  oilTemp: number | null;
  waterTemp: number | null;
  units: 'metric' | 'imperial';
  showRpmBar: boolean;
  showTemps: boolean;
  showRpmColor: boolean;
}

const applyArgs = (args: StoryArgs) => {
  runInAction(() => {
    telemetryStore.updateSessionInfo(BASE_SESSION_INFO);

    telemetryStore.updateCarDynamics({
      speed: args.speedKmh / 3.6,
      rpm: args.rpm,
      gear: args.gear,
    } as Parameters<typeof telemetryStore.updateCarDynamics>[0]);

    telemetryStore.updateCarStatus({
      on_pit_road: args.onPitRoad,
      engine_warnings: args.engineWarnings,
      oil_temp: args.oilTemp,
      water_temp: args.waterTemp,
    } as Parameters<typeof telemetryStore.updateCarStatus>[0]);

    unitsStore.setSystem(args.units);

    widgetSettingsStore.updateUserSettings('speed', {
      ...widgetSettingsStore.getSpeedSettings(),
      showRpmBar: args.showRpmBar,
      showTemps: args.showTemps,
      showRpmColor: args.showRpmColor,
    });
  });
};

const StoryRenderer = (args: StoryArgs) => {
  useEffect(() => {
    applyArgs(args);
  });

  return <SpeedWidget />;
};

const RpmAnimatedRenderer = () => {
  const rpmRef = useRef(800);
  const dirRef = useRef(1);

  useEffect(() => {
    runInAction(() => telemetryStore.updateSessionInfo(BASE_SESSION_INFO));

    const intervalId = setInterval(() => {
      rpmRef.current += dirRef.current * 120;

      if (rpmRef.current >= RED_LINE) {
        dirRef.current = -1;
      } else if (rpmRef.current <= 800) {
        dirRef.current = 1;
      }

      runInAction(() => {
        telemetryStore.updateCarDynamics({
          speed: rpmRef.current / 140,
          rpm: rpmRef.current,
          gear: Math.max(1, Math.ceil(rpmRef.current / 1500)),
        } as Parameters<typeof telemetryStore.updateCarDynamics>[0]);
      });
    }, 50);

    return () => clearInterval(intervalId);
  }, []);

  return <SpeedWidget />;
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/SpeedWidget',
  render: StoryRenderer,
  parameters: { layout: 'centered' },
  decorators: [
    widgetDecorator({
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      background: BG,
    }),
  ],
  argTypes: {
    speedKmh: { control: { type: 'number', step: 1 }, name: 'speed (km/h)' },
    rpm: { control: { type: 'number', step: 100 } },
    gear: { control: { type: 'number', min: -1, max: 8, step: 1 } },
    onPitRoad: { control: 'boolean' },
    engineWarnings: { control: { type: 'number' } },
    oilTemp: { control: { type: 'number' } },
    waterTemp: { control: { type: 'number' } },
    units: { control: 'radio', options: ['metric', 'imperial'] },
    showRpmBar: { control: 'boolean' },
    showTemps: { control: 'boolean' },
    showRpmColor: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

const baseArgs: StoryArgs = {
  speedKmh: 120,
  rpm: 5400,
  gear: 3,
  onPitRoad: false,
  engineWarnings: 0,
  oilTemp: null,
  waterTemp: null,
  units: 'metric',
  showRpmBar: true,
  showTemps: false,
  showRpmColor: true,
};

export const Default: Story = {
  args: baseArgs,
};

export const HighSpeed: Story = {
  args: { ...baseArgs, speedKmh: 267, rpm: 7800, gear: 6 },
};

export const PitLimiterActive: Story = {
  args: {
    ...baseArgs,
    speedKmh: 60,
    rpm: 3100,
    gear: 3,
    onPitRoad: true,
    engineWarnings: 0x10,
  },
};

export const OverPitLimit: Story = {
  args: {
    ...baseArgs,
    speedKmh: 67,
    rpm: 3400,
    gear: 3,
    onPitRoad: true,
    engineWarnings: 0x10,
  },
};

export const TempWarning: Story = {
  args: { ...baseArgs, oilTemp: 135, waterTemp: 132, showTemps: true },
};

export const Imperial: Story = {
  args: { ...baseArgs, speedKmh: 200, rpm: 7200, gear: 5, units: 'imperial' },
};

export const RpmAnimated: StoryObj = {
  render: RpmAnimatedRenderer,
};
