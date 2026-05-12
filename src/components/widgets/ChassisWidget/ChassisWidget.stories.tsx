import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChassisWidget } from './ChassisWidget';
import type { CornerData } from './types';

const makeCorner = (overrides: Partial<CornerData> = {}): CornerData => ({
  wearL: 0.85,
  wearM: 0.8,
  wearR: 0.78,
  tempL: 82,
  tempM: 88,
  tempR: 84,
  tempColorL: '#22c55e',
  tempColorM: '#22c55e',
  tempColorR: '#22c55e',
  pressure: 1.8,
  pressureUnit: 'bar',
  rideHeight: 42,
  shockDefl: 12,
  brakeTemp: 320,
  brakeTempColor: '#22c55e',
  isPunctured: false,
  isBrakeOverheated: false,
  ...overrides,
});

const makeDisconnectedCorner = (): CornerData => ({
  wearL: null,
  wearM: null,
  wearR: null,
  tempL: null,
  tempM: null,
  tempR: null,
  tempColorL: '#475569',
  tempColorM: '#475569',
  tempColorR: '#475569',
  pressure: null,
  pressureUnit: 'kPa',
  rideHeight: null,
  shockDefl: null,
  brakeTemp: null,
  brakeTempColor: '#475569',
  isPunctured: false,
  isBrakeOverheated: false,
});

const DEFAULT_ARGS = {
  lf: makeCorner(),
  rf: makeCorner(),
  lr: makeCorner({ wearL: 0.7, wearM: 0.72, wearR: 0.68 }),
  rr: makeCorner({ wearL: 0.7, wearM: 0.72, wearR: 0.68 }),
  tempUnit: '°C',
  lengthUnit: 'mm',
  showInboard: false,
  onPitRoad: false,
};

const meta: Meta<typeof ChassisWidget> = {
  title: 'Widgets/ChassisWidget',
  component: ChassisWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
          display: 'inline-block',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: DEFAULT_ARGS,
};

export default meta;
type Story = StoryObj<typeof ChassisWidget>;

export const Default: Story = {};

export const Disconnected: Story = {
  args: {
    lf: makeDisconnectedCorner(),
    rf: makeDisconnectedCorner(),
    lr: makeDisconnectedCorner(),
    rr: makeDisconnectedCorner(),
    onPitRoad: true,
  },
};

export const OnPitRoad: Story = {
  args: { onPitRoad: true },
};

export const WithInboard: Story = {
  args: { showInboard: true, onPitRoad: true },
};

export const Punctured: Story = {
  args: {
    lf: makeCorner({ isPunctured: true, pressure: 0.4 }),
    onPitRoad: true,
  },
};

export const BrakeOverheat: Story = {
  args: {
    lf: makeCorner({
      isBrakeOverheated: true,
      brakeTemp: 850,
      brakeTempColor: '#ef4444',
    }),
    rf: makeCorner({
      isBrakeOverheated: true,
      brakeTemp: 820,
      brakeTempColor: '#ef4444',
    }),
    onPitRoad: true,
  },
};

export const ImperialUnits: Story = {
  args: {
    tempUnit: '°F',
    lengthUnit: 'in',
    lf: makeCorner({
      tempL: 180,
      tempM: 190,
      tempR: 188,
      tempColorL: '#f97316',
      tempColorM: '#ef4444',
      tempColorR: '#f97316',
      pressure: 26.0,
      pressureUnit: 'psi',
    }),
    rf: makeCorner({
      tempL: 180,
      tempM: 190,
      tempR: 188,
      tempColorL: '#f97316',
      tempColorM: '#ef4444',
      tempColorR: '#f97316',
      pressure: 26.0,
      pressureUnit: 'psi',
    }),
    lr: makeCorner({
      tempL: 175,
      tempM: 185,
      tempR: 182,
      tempColorL: '#eab308',
      tempColorM: '#f97316',
      tempColorR: '#eab308',
      pressure: 25.5,
      pressureUnit: 'psi',
    }),
    rr: makeCorner({
      tempL: 175,
      tempM: 185,
      tempR: 182,
      tempColorL: '#eab308',
      tempColorM: '#f97316',
      tempColorR: '#eab308',
      pressure: 25.5,
      pressureUnit: 'psi',
    }),
    onPitRoad: true,
  },
};
