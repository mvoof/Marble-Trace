import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChassisWidget } from './ChassisWidget';
import { WidgetScaler } from '../../WidgetScaler';
import type { CornerData } from './types';

const DESIGN_WIDTH = 460;
const DESIGN_HEIGHT = 320;

// Realistic kPa values: 155 kPa ≈ 22.5 PSI (normal racing tire pressure)
const normalCorner = (
  rh: number,
  shk: number,
  brk: number,
  pressure = 155
): CornerData => ({
  wearL: 0.82,
  wearM: 0.65,
  wearR: 0.4,
  tempL: 74,
  tempM: 89,
  tempR: 89,
  pressure,
  pressureUnit: 'kPa',
  rideHeight: rh,
  shockDefl: shk,
  brakeTemp: brk,
  isPunctured: false,
  isBrakeOverheated: false,
});

const DEFAULT_CORNERS = {
  lf: normalCorner(45.2, 12.1, 380),
  rf: {
    ...normalCorner(45.5, 11.8, 375, 157),
    wearL: 0.2,
    wearM: 0.5,
    wearR: 0.76,
    tempL: 89,
    tempM: 89,
    tempR: 74,
  },
  lr: normalCorner(52.1, 15.0, 210, 166),
  rr: {
    ...normalCorner(52.4, 14.9, 215, 164),
    wearL: 0.4,
    wearM: 0.65,
    wearR: 0.78,
    tempL: 89,
    tempM: 89,
    tempR: 74,
  },
};

const Wrapper = (props: React.ComponentProps<typeof ChassisWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <ChassisWidget {...props} />
    </WidgetScaler>
  </div>
);

const meta: Meta<React.ComponentProps<typeof ChassisWidget>> = {
  title: 'Widgets/ChassisWidget',
  component: Wrapper,
  parameters: { layout: 'centered' },
  args: {
    ...DEFAULT_CORNERS,
    tempUnit: '°C',
    lengthUnit: 'mm',
  },
};

export default meta;

type Story = StoryObj<React.ComponentProps<typeof ChassisWidget>>;

export const Default: Story = {};

export const Imperial: Story = {
  args: {
    tempUnit: '°F',
    lengthUnit: 'in',
    lf: {
      ...DEFAULT_CORNERS.lf,
      tempL: 165.2,
      tempM: 192.2,
      tempR: 192.2,
      brakeTemp: 716,
      rideHeight: 1.78,
      shockDefl: 0.476,
      pressure: 22.5,
      pressureUnit: 'PSI',
    },
    rf: {
      ...DEFAULT_CORNERS.rf,
      tempL: 192.2,
      tempM: 192.2,
      tempR: 165.2,
      brakeTemp: 707,
      rideHeight: 1.79,
      shockDefl: 0.465,
      pressure: 22.8,
      pressureUnit: 'PSI',
    },
    lr: {
      ...DEFAULT_CORNERS.lr,
      tempL: 165.2,
      tempM: 192.2,
      tempR: 192.2,
      brakeTemp: 410,
      rideHeight: 2.05,
      shockDefl: 0.591,
      pressure: 24.1,
      pressureUnit: 'PSI',
    },
    rr: {
      ...DEFAULT_CORNERS.rr,
      tempL: 192.2,
      tempM: 192.2,
      tempR: 165.2,
      brakeTemp: 419,
      rideHeight: 2.06,
      shockDefl: 0.587,
      pressure: 23.9,
      pressureUnit: 'PSI',
    },
  },
};

export const DamageState: Story = {
  args: {
    lf: {
      ...DEFAULT_CORNERS.lf,
      pressure: 5.2,
      pressureUnit: 'kPa',
      rideHeight: 20.0,
      brakeTemp: 920,
      isPunctured: true,
      isBrakeOverheated: true,
    },
    rf: DEFAULT_CORNERS.rf,
    lr: DEFAULT_CORNERS.lr,
    rr: DEFAULT_CORNERS.rr,
  },
};

export const HotTires: Story = {
  args: {
    lf: { ...DEFAULT_CORNERS.lf, tempL: 130, tempM: 138, tempR: 135 },
    rf: { ...DEFAULT_CORNERS.rf, tempL: 132, tempM: 140, tempR: 128 },
    lr: { ...DEFAULT_CORNERS.lr, tempL: 128, tempM: 135, tempR: 130 },
    rr: { ...DEFAULT_CORNERS.rr, tempL: 126, tempM: 133, tempR: 129 },
  },
};
