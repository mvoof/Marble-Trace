import { useLayoutEffect, useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { SessionInfo } from '@/types/bindings';
import type { SpeedWidgetSettings } from '@/types/widget-settings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import type { UnitsStore } from '@store/units.store';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
  useUnitsStore,
} from '@store/root-store-context';
import { SpeedWidget } from './SpeedWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

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

const applyArgs = (
  stores: {
    telemetry: TelemetryStore;
    widgetSettings: WidgetSettingsStore;
    units: UnitsStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.telemetry.updateSessionInfo(BASE_SESSION_INFO);

    stores.telemetry.updateCarDynamics({
      speed: args.speedKmh / 3.6,
      rpm: args.rpm,
      gear: args.gear,
    } as Parameters<typeof stores.telemetry.updateCarDynamics>[0]);

    stores.telemetry.updateCarStatus({
      on_pit_road: args.onPitRoad,
      engine_warnings: args.engineWarnings,
      oil_temp: args.oilTemp,
      water_temp: args.waterTemp,
    } as Parameters<typeof stores.telemetry.updateCarStatus>[0]);

    stores.units.setSystem(args.units);

    stores.widgetSettings.updateUserSettings('speed', {
      ...stores.widgetSettings.getSettings<SpeedWidgetSettings>('speed'),
      showRpmBar: args.showRpmBar,
      showTemps: args.showTemps,
      showRpmColor: args.showRpmColor,
    });
  });
};

const StoryRenderer = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const units = useUnitsStore();

  useLayoutEffect(() => {
    applyArgs({ telemetry, widgetSettings, units }, args);
  }, [args, telemetry, widgetSettings, units]);

  return <SpeedWidget />;
};

const RpmAnimatedRenderer = () => {
  const telemetry = useTelemetryStore();
  const rpmRef = useRef(800);
  const dirRef = useRef(1);

  useEffect(() => {
    runInAction(() => telemetry.updateSessionInfo(BASE_SESSION_INFO));

    const intervalId = setInterval(() => {
      rpmRef.current += dirRef.current * 120;

      if (rpmRef.current >= RED_LINE) {
        dirRef.current = -1;
      } else if (rpmRef.current <= 800) {
        dirRef.current = 1;
      }

      runInAction(() => {
        telemetry.updateCarDynamics({
          speed: rpmRef.current / 140,
          rpm: rpmRef.current,
          gear: Math.max(1, Math.ceil(rpmRef.current / 1500)),
        } as Parameters<typeof telemetry.updateCarDynamics>[0]);
      });
    }, 50);

    return () => clearInterval(intervalId);
  }, [telemetry]);

  return <SpeedWidget />;
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/SpeedWidget',
  render: StoryRenderer,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(seedFromSnapshot),
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

export const Reverse: Story = {
  args: { ...baseArgs, speedKmh: 8, rpm: 1800, gear: -1 },
};

export const Neutral: Story = {
  args: { ...baseArgs, speedKmh: 0, rpm: 900, gear: 0 },
};

export const NoRpmBar: Story = {
  args: { ...baseArgs, showRpmBar: false },
};

export const WithTemps: Story = {
  args: { ...baseArgs, oilTemp: 95, waterTemp: 88, showTemps: true },
};

export const RpmAnimated: StoryObj = {
  render: RpmAnimatedRenderer,
};
