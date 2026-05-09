import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeatherWidget } from './WeatherWidget';

const FORECAST = [
  {
    Time: 3600,
    Skies: 'Clear' as const,
    Temp: 22,
    WindSpeed: 3.5,
    WindDir: 270,
  },
  {
    Time: 7200,
    Skies: 'PartlyCloudy' as const,
    Temp: 21,
    WindSpeed: 5.0,
    WindDir: 280,
  },
  {
    Time: 10800,
    Skies: 'MostlyCloudy' as const,
    Temp: 20,
    WindSpeed: 6.2,
    WindDir: 260,
  },
];

const meta: Meta<typeof WeatherWidget> = {
  title: 'Widgets/WeatherWidget',
  component: WeatherWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
          display: 'inline-block',
          minWidth: 200,
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    windBearing: 270,
    carYawDeg: 90,
    windSpeedFormatted: '12.6',
    windCardinal: 'W',
    windColor: '#60a5fa',
    airTempFormatted: '22',
    trackTempFormatted: '34',
    tempUnit: '°C',
    unitSystem: 'metric',
    humidity: '58%',
    forecast: [],
    weatherType: null,
    showCompass: true,
    showAirTemp: true,
    showTrackTemp: true,
    showWind: true,
    showHumidity: true,
    showForecast: false,
  },
};

export default meta;
type Story = StoryObj<typeof WeatherWidget>;

export const Default: Story = {};

export const Imperial: Story = {
  args: {
    airTempFormatted: '72',
    trackTempFormatted: '93',
    tempUnit: '°F',
    unitSystem: 'imperial',
    windSpeedFormatted: '7.8',
  },
};

export const NoCompass: Story = {
  args: {
    showCompass: false,
  },
};

export const WithForecast: Story = {
  args: {
    showForecast: true,
    forecast: FORECAST,
  },
};

export const StaticWeather: Story = {
  args: {
    showForecast: true,
    forecast: [],
    weatherType: 'Static',
  },
};

export const MinimalView: Story = {
  args: {
    showCompass: false,
    showHumidity: false,
    showForecast: false,
  },
};
