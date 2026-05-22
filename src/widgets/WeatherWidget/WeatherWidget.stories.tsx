import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type {
  EnvironmentFrame,
  SessionInfo,
  WeatherForecastEntry,
} from '@/types/bindings';
import type { UnitSystem } from '@/types';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import type { UnitsStore } from '@store/units.store';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
  useUnitsStore,
} from '@store/root-store-context';
import { WeatherWidget } from './WeatherWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

const FORECAST: WeatherForecastEntry[] = [
  {
    Time: 3600,
    Skies: 'Clear',
    Temp: 22,
    WindSpeed: 3.5,
    WindDir: 270,
  } as WeatherForecastEntry,
  {
    Time: 7200,
    Skies: 'PartlyCloudy',
    Temp: 21,
    WindSpeed: 5.0,
    WindDir: 280,
  } as WeatherForecastEntry,
  {
    Time: 10800,
    Skies: 'MostlyCloudy',
    Temp: 20,
    WindSpeed: 6.2,
    WindDir: 260,
  } as WeatherForecastEntry,
];

interface StoryArgs {
  system: UnitSystem;
  airTempC: number;
  trackTempC: number;
  windVelMps: number;
  windDirRad: number;
  humidity: number;
  weatherType: string | null;
  forecast: WeatherForecastEntry[];
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
  showForecast: boolean;
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
    stores.units.setSystem(args.system);

    stores.telemetry.updateEnvironment({
      air_temp: args.airTempC,
      track_temp: args.trackTempC,
      wind_vel: args.windVelMps,
      wind_dir: args.windDirRad,
      relative_humidity: args.humidity / 100,
    } as EnvironmentFrame);

    stores.telemetry.updateSessionInfo({
      WeekendInfo: {
        TrackWeatherType: args.weatherType,
      },
    } as SessionInfo);

    stores.telemetry.updateWeatherForecast(args.forecast);

    stores.widgetSettings.updateUserSettings('weather', {
      showCompass: args.showCompass,
      showAirTemp: args.showAirTemp,
      showTrackTemp: args.showTrackTemp,
      showWind: args.showWind,
      showHumidity: args.showHumidity,
      showForecast: args.showForecast,
    });
  });
};

const StoryHost = (args: StoryArgs) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const units = useUnitsStore();

  useLayoutEffect(() => {
    applyArgs({ telemetry, widgetSettings, units }, args);
  }, [args, telemetry, widgetSettings, units]);

  return <WeatherWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/WeatherWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(seedFromSnapshot),
    widgetDecorator({ display: 'inline-block', minWidth: 200 }),
  ],
  args: {
    system: 'metric',
    airTempC: 22,
    trackTempC: 34,
    windVelMps: 3.5,
    windDirRad: Math.PI,
    humidity: 58,
    weatherType: null,
    forecast: [],
    showCompass: true,
    showAirTemp: true,
    showTrackTemp: true,
    showWind: true,
    showHumidity: true,
    showForecast: false,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const Imperial: Story = {
  args: { system: 'imperial' },
};

export const NoCompass: Story = {
  args: { showCompass: false },
};

export const WithForecast: Story = {
  args: { showForecast: true, forecast: FORECAST },
};

export const StaticWeather: Story = {
  args: { showForecast: true, forecast: [], weatherType: 'Static' },
};

export const MinimalView: Story = {
  args: {
    showCompass: false,
    showHumidity: false,
    showForecast: false,
  },
};

export const HotDay: Story = {
  args: { airTempC: 38, trackTempC: 58, windVelMps: 1.0, humidity: 30 },
};

export const StrongWind: Story = {
  args: { windVelMps: 12.5, windDirRad: Math.PI * 0.75 },
};

export const NightRace: Story = {
  args: {
    airTempC: 16,
    trackTempC: 18,
    windVelMps: 2.0,
    humidity: 72,
    showForecast: true,
    forecast: FORECAST,
  },
};
