import type { Meta, StoryObj } from '@storybook/react-vite';

import type { EnvironmentFrame } from '@/types/bindings';
import type { UnitSystem } from '@/types';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import { mockEnvironment, mockForecast } from '@store/preview/mocks/weather';
import { whenSet } from '@/storybook/story-overrides';
import { WeatherWidget } from './WeatherWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

// Three hours of a sky closing in, which is what the strip has to lay out: the
// widest surface label, a rising rain chance and a wind that keeps moving.
const FORECAST = mockForecast([
  {
    time: 3600,
    skies: 'Clear',
    tempC: 22,
    windVelMps: 3.5,
    windDirRad: Math.PI * 1.5,
  },
  {
    time: 7200,
    skies: 'PartlyCloudy',
    tempC: 21,
    windVelMps: 5,
    windDirRad: Math.PI * 1.56,
  },
  {
    time: 10800,
    skies: 'MostlyCloudy',
    tempC: 20,
    windVelMps: 6.2,
    windDirRad: Math.PI * 1.44,
  },
]);

interface StoryArgs {
  system: UnitSystem;
  /**
   * The conditions. Left undefined — which is what a story naming a scenario
   * does — the base's own reading is kept, so a knob states a difference
   * rather than replacing the frame.
   */
  airTempC?: number;
  trackTempC?: number;
  windVelMps?: number;
  windDirRad?: number;
  /** Relative humidity as a percentage, the way the widget prints it. */
  humidity?: number;
  trackWetness?: number;
  /** The sim's own weather mode; `Static` is the one the strip names. */
  weatherType?: string;
  showForecast: boolean;
  /** The hours the strip draws — only the forecast stories have any. */
  withForecast: boolean;

  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
  showTrackWetness: boolean;
  showWindBearing: boolean;
}

// Only the knobs a story actually turned reach the frame; everything else is
// left to the scenario or to the builder's dry track underneath.
const environmentOverrides = (args: StoryArgs): Partial<EnvironmentFrame> => ({
  ...whenSet(args.airTempC, (airTemp) => ({ airTemp })),
  ...whenSet(args.trackTempC, (trackTemp) => ({ trackTemp })),
  ...whenSet(args.windVelMps, (windVel) => ({ windVel })),
  ...whenSet(args.windDirRad, (windDir) => ({ windDir })),
  ...whenSet(args.humidity, (percent) => ({ relativeHumidity: percent / 100 })),
  ...whenSet(args.trackWetness, (trackWetness) => ({ trackWetness })),
});

const meta: Meta<StoryArgs> = {
  title: 'Widgets/WeatherWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: WeatherWidget,
    size: { width: 200, height: 440 },
    seedSnapshot: true,
    seed: (store, args, scenarioId) => {
      store.units.setSystem(args.system);

      const overrides = environmentOverrides(args);

      // A story with no scenario under it states the builder's dry track; one
      // with a scenario patches the rain that scenario already put down rather
      // than replacing it with a dry frame.
      const base = store.environment.environment;

      store.environment.updateEnvironment(
        scenarioId && base
          ? { ...base, ...overrides }
          : mockEnvironment('dry', overrides)
      );

      const sessionInfo = store.session.sessionInfo;

      // Only a story naming a weather type states one; otherwise the seeded
      // session keeps its own, scenario or snapshot.
      if (sessionInfo && args.weatherType !== undefined) {
        store.session.updateSessionInfo({
          ...sessionInfo,
          trackWeatherType: args.weatherType,
        });
      }

      store.environment.updateWeatherForecast(
        args.withForecast ? FORECAST : []
      );

      store.liveWidgets.updateUserSettings('weather', {
        ...store.liveWidgets.getSettings<WeatherWidgetSettings>('weather'),
        showCompass: args.showCompass,
        showAirTemp: args.showAirTemp,
        showTrackTemp: args.showTrackTemp,
        showWind: args.showWind,
        showHumidity: args.showHumidity,
        showTrackWetness: args.showTrackWetness,
        showWindBearing: args.showWindBearing,
        showForecast: args.showForecast,
      });
    },
    args: {
      system: 'metric',
      showForecast: false,
      withForecast: false,
      showCompass: true,
      showAirTemp: true,
      showTrackTemp: true,
      showWind: true,
      showHumidity: true,
      showTrackWetness: true,
      showWindBearing: true,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const Imperial: Story = {
  args: { system: 'imperial' },
};

export const NoCompass: Story = {
  args: { showCompass: false },
};

export const WithForecast: Story = {
  args: { showForecast: true, withForecast: true },
};

export const StaticWeather: Story = {
  args: { showForecast: true, weatherType: 'Static' },
};

export const MinimalView: Story = {
  args: { showCompass: false, showHumidity: false, showForecast: false },
};

export const HotDay: Story = {
  args: { airTempC: 38, trackTempC: 58, windVelMps: 1, humidity: 30 },
};

export const WetTrack: Story = {
  parameters: previewScenario('rain'),
};

export const HeavyRain: Story = {
  parameters: previewScenario('heavy-rain'),
};

export const OddStatCount: Story = {
  args: { showHumidity: false },
};

export const StrongWind: Story = {
  args: { windVelMps: 12.5, windDirRad: Math.PI * 0.75 },
};

export const NightRace: Story = {
  args: {
    airTempC: 16,
    trackTempC: 18,
    windVelMps: 2,
    humidity: 72,
    showForecast: true,
    withForecast: true,
  },
};
