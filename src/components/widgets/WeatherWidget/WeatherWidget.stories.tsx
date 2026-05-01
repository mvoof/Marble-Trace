import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeatherWidget } from './WeatherWidget';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 340;

const wrap = (props: ComponentProps<typeof WeatherWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
        overflow: 'hidden',
      }}
    >
      <WeatherWidget {...props} />
    </div>
  </div>
);

const meta: Meta<typeof WeatherWidget> = {
  title: 'Widgets/WeatherWidget',
  component: WeatherWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof WeatherWidget>;

const allVisible = {
  showCompass: true,
  showAirTemp: true,
  showTrackTemp: true,
  showWind: true,
  showHumidity: true,
  showForecast: true,
  unitSystem: 'metric' as const,
};

const mockForecast = [
  {
    Time: 3600 * 14, // 14:00
    Temp: 24,
    WindSpeed: 5,
    WindDir: 0,
    Skies: 0,
    Humidity: 50,
    Fog: 0,
    RainPct: 0,
  },
  {
    Time: 3600 * 15, // 15:00
    Temp: 26,
    WindSpeed: 6,
    WindDir: 45,
    Skies: 1,
    Humidity: 45,
    Fog: 0,
    RainPct: 0,
  },
  {
    Time: 3600 * 16, // 16:00
    Temp: 25,
    WindSpeed: 8,
    WindDir: 90,
    Skies: 2,
    Humidity: 48,
    Fog: 0,
    RainPct: 10,
  },
];

export const Default: Story = {
  args: {
    ...allVisible,
    windBearing: 315,
    carYawDeg: 0,
    windSpeedFormatted: '12 KM/H',
    windCardinal: 'NW',
    airTempFormatted: '22.4',
    trackTempFormatted: '38.1',
    tempUnit: '°C',
    humidity: '62%',
    forecast: mockForecast,
    windColor: '#3399ff',
  },
};

export const StrongWindNorth: Story = {
  args: {
    ...allVisible,
    windBearing: 0,
    carYawDeg: 0,
    windSpeedFormatted: '48 KM/H',
    windCardinal: 'N',
    airTempFormatted: '18.0',
    trackTempFormatted: '25.5',
    tempUnit: '°C',
    humidity: '74%',
    forecast: mockForecast,
    windColor: '#ef4444',
  },
};

export const HeadingEast: Story = {
  args: {
    ...allVisible,
    windBearing: 0,
    carYawDeg: 90,
    windSpeedFormatted: '20 KM/H',
    windCardinal: 'N',
    airTempFormatted: '24.0',
    trackTempFormatted: '40.2',
    tempUnit: '°C',
    humidity: '55%',
    forecast: mockForecast,
    windColor: '#ffcc00',
  },
};

export const Imperial: Story = {
  args: {
    ...allVisible,
    unitSystem: 'imperial',
    windBearing: 0,
    carYawDeg: 0,
    windSpeedFormatted: '30 MPH',
    windCardinal: 'N',
    airTempFormatted: '72',
    trackTempFormatted: '104',
    tempUnit: '°F',
    humidity: '50%',
    forecast: [
      {
        Time: 3600 * 12,
        Temp: 20, // 68 F
        WindSpeed: 10, // 22 mph
        WindDir: 0,
        Skies: 0,
        Humidity: 50,
        Fog: 0,
        RainPct: 0,
      },
    ],
    windColor: '#fff',
  },
};

export const NoCompass: Story = {
  args: {
    ...allVisible,
    showCompass: false,
    windBearing: 180,
    carYawDeg: 45,
    windSpeedFormatted: '8 KM/H',
    windCardinal: 'S',
    airTempFormatted: '30.2',
    trackTempFormatted: '52.8',
    tempUnit: '°C',
    humidity: '40%',
    forecast: mockForecast,
    windColor: '#3399ff',
  },
};

export const NoData: Story = {
  args: {
    ...allVisible,
    windBearing: 0,
    carYawDeg: 0,
    windSpeedFormatted: '—',
    windCardinal: 'N',
    airTempFormatted: '—',
    trackTempFormatted: '—',
    tempUnit: '°C',
    humidity: '—',
    forecast: [],
    windColor: '#3399ff',
  },
};
