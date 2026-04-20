import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeatherWidget } from './WeatherWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 300;
const DESIGN_HEIGHT = 200;

const wrap = (props: ComponentProps<typeof WeatherWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <WeatherWidget {...props} />
    </WidgetScaler>
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

export const Default: Story = {
  args: {
    windBearing: 315,
    carYawDeg: 0,
    windSpeedFormatted: '12 KM/H',
    windCardinal: 'NW',
    airTempFormatted: '22.4',
    trackTempFormatted: '38.1',
    tempUnit: '°C',
    skiesText: 'Partly Cloudy',
    skiesIcon: 'cloud-sun',
  },
};

export const StrongWindNorth: Story = {
  args: {
    windBearing: 0,
    carYawDeg: 0,
    windSpeedFormatted: '48 KM/H',
    windCardinal: 'N',
    airTempFormatted: '18.0',
    trackTempFormatted: '25.5',
    tempUnit: '°C',
    skiesText: 'Overcast',
    skiesIcon: 'cloud',
  },
};

export const HeadingWest: Story = {
  args: {
    windBearing: 0,
    carYawDeg: 90,
    windSpeedFormatted: '20 KM/H',
    windCardinal: 'N',
    airTempFormatted: '24.0',
    trackTempFormatted: '40.2',
    tempUnit: '°C',
    skiesText: 'Clear',
    skiesIcon: 'sun',
  },
};

export const ClearSky: Story = {
  args: {
    windBearing: 180,
    carYawDeg: 45,
    windSpeedFormatted: '8 KM/H',
    windCardinal: 'S',
    airTempFormatted: '30.2',
    trackTempFormatted: '52.8',
    tempUnit: '°C',
    skiesText: 'Clear',
    skiesIcon: 'sun',
  },
};

export const Rainy: Story = {
  args: {
    windBearing: 270,
    carYawDeg: 180,
    windSpeedFormatted: '35 KM/H',
    windCardinal: 'W',
    airTempFormatted: '12.1',
    trackTempFormatted: '14.0',
    tempUnit: '°C',
    skiesText: 'Rain',
    skiesIcon: 'cloud-rain',
  },
};

export const NoData: Story = {
  args: {
    windBearing: 0,
    carYawDeg: 0,
    windSpeedFormatted: '—',
    windCardinal: 'N',
    airTempFormatted: '—',
    trackTempFormatted: '—',
    tempUnit: '°C',
    skiesText: '',
    skiesIcon: 'sun',
  },
};
