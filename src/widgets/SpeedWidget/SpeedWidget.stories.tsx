import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { SessionInfo } from '@/types/bindings';
import type { SpeedWidgetSettings } from '@/types/widget-settings';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import { useStore } from '@store/root-store-context';
import { SpeedWidget } from './SpeedWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

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

const setDynamics = (telemetry: TelemetryStore, rpm: number, gear: number) =>
  telemetry.updateCarDynamics({
    speed: rpm / 140,
    rpm,
    gear,
  } as Parameters<typeof telemetry.updateCarDynamics>[0]);

const meta: Meta<StoryArgs> = {
  title: 'Widgets/SpeedWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: SpeedWidget,
    size: { width: 500, height: 120, background: 'rgba(21, 22, 26, 0.8)' },
    seedSnapshot: true,
    seed: (store, args) => {
      store.telemetry.updateSessionInfo(BASE_SESSION_INFO);

      store.telemetry.updateCarDynamics({
        speed: args.speedKmh / 3.6,
        rpm: args.rpm,
        gear: args.gear,
      } as Parameters<typeof store.telemetry.updateCarDynamics>[0]);

      store.telemetry.updateCarStatus({
        on_pit_road: args.onPitRoad,
        engine_warnings: args.engineWarnings,
        oil_temp: args.oilTemp,
        water_temp: args.waterTemp,
      } as Parameters<typeof store.telemetry.updateCarStatus>[0]);

      store.units.setSystem(args.units);

      store.widgetSettings.updateUserSettings('speed', {
        ...store.widgetSettings.getSettings<SpeedWidgetSettings>('speed'),
        showRpmBar: args.showRpmBar,
        showTemps: args.showTemps,
        showRpmColor: args.showRpmColor,
      });
    },
    args: {
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
    },
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
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const HighSpeed: Story = {
  args: { speedKmh: 267, rpm: 7800, gear: 6 },
};

export const PitLimiterActive: Story = {
  args: {
    speedKmh: 60,
    rpm: 3100,
    gear: 3,
    onPitRoad: true,
    engineWarnings: 0x10,
  },
};

export const OverPitLimit: Story = {
  args: {
    speedKmh: 67,
    rpm: 3400,
    gear: 3,
    onPitRoad: true,
    engineWarnings: 0x10,
  },
};

export const TempWarning: Story = {
  args: { oilTemp: 135, waterTemp: 132, showTemps: true },
};

export const Imperial: Story = {
  args: { speedKmh: 200, rpm: 7200, gear: 5, units: 'imperial' },
};

export const Reverse: Story = {
  args: { speedKmh: 8, rpm: 1800, gear: -1 },
};

export const Neutral: Story = {
  args: { speedKmh: 0, rpm: 900, gear: 0 },
};

export const NoRpmBar: Story = {
  args: { showRpmBar: false },
};

export const WithTemps: Story = {
  args: { oilTemp: 95, waterTemp: 88, showTemps: true },
};

const RpmAnimatedRenderer = () => {
  const store = useStore();
  const rpmRef = useRef(800);
  const dirRef = useRef(1);

  useEffect(() => {
    runInAction(() => store.telemetry.updateSessionInfo(BASE_SESSION_INFO));

    const intervalId = setInterval(() => {
      rpmRef.current += dirRef.current * 120;

      if (rpmRef.current >= RED_LINE) {
        dirRef.current = -1;
      } else if (rpmRef.current <= 800) {
        dirRef.current = 1;
      }

      runInAction(() => {
        setDynamics(
          store.telemetry,
          rpmRef.current,
          Math.max(1, Math.ceil(rpmRef.current / 1500))
        );
      });
    }, 50);

    return () => clearInterval(intervalId);
  }, [store]);

  return <SpeedWidget />;
};

export const RpmAnimated: StoryObj = {
  render: RpmAnimatedRenderer,
};
