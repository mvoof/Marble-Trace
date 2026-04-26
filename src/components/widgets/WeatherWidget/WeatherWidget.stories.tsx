import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeatherWidget } from './WeatherWidget';

const DESIGN_WIDTH = 240;
const DESIGN_HEIGHT = 280;

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
};

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
  },
};

export const HeadingWest: Story = {
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
  },
};
