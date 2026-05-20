import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { telemetryStore } from '../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { unitsStore } from '../../store/units.store';
import type {
  EnvironmentFrame,
  SessionInfo,
  WeatherForecastEntry,
} from '../../types/bindings';
import type { UnitSystem } from '../../types';
import { WeatherWidget } from './WeatherWidget';
import { widgetDecorator } from '../../storybook/widgetDecorator';

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

const applyArgs = (args: StoryArgs) => {
  runInAction(() => {
    unitsStore.setSystem(args.system);

    telemetryStore.updateEnvironment({
      air_temp: args.airTempC,
      track_temp: args.trackTempC,
      wind_vel: args.windVelMps,
      wind_dir: args.windDirRad,
      relative_humidity: args.humidity / 100,
    } as EnvironmentFrame);

    telemetryStore.updateSessionInfo({
      WeekendInfo: {
        TrackWeatherType: args.weatherType,
      },
    } as SessionInfo);

    telemetryStore.updateWeatherForecast(args.forecast);

    widgetSettingsStore.updateUserSettings('weather', {
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
  useEffect(() => {
    applyArgs(args);
  }, [args]);
  return <WeatherWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/WeatherWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ display: 'inline-block', minWidth: 200 })],
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
