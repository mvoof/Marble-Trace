import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LapDeltaWidget } from './LapDeltaWidget';
import { WidgetScaler } from '../../WidgetScaler';

const DESIGN_WIDTH = 320;
const DESIGN_HEIGHT = 90;

const wrap = (props: ComponentProps<typeof LapDeltaWidget>) => (
  <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
    <WidgetScaler
      designWidth={DESIGN_WIDTH}
      designHeight={DESIGN_HEIGHT}
      background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
    >
      <LapDeltaWidget {...props} />
    </WidgetScaler>
  </div>
);

const meta: Meta<typeof LapDeltaWidget> = {
  title: 'Widgets/LapDeltaWidget',
  component: LapDeltaWidget,
  parameters: { layout: 'centered' },
  render: (args) => wrap(args),
};

export default meta;

type Story = StoryObj<typeof LapDeltaWidget>;

export const Default: Story = {
  args: {
    deltaFormatted: '+1.234',
    deltaState: 'behind',
    barPct: 0.41,
    bestLapFormatted: '1:33.756',
    hasDelta: true,
  },
};

export const Ahead: Story = {
  args: {
    deltaFormatted: '-0.456',
    deltaState: 'ahead',
    barPct: 0.15,
    bestLapFormatted: '1:33.756',
    hasDelta: true,
  },
};

export const NearZero: Story = {
  args: {
    deltaFormatted: '+0.023',
    deltaState: 'behind',
    barPct: 0.008,
    bestLapFormatted: '1:33.756',
    hasDelta: true,
  },
};

export const MaxBehind: Story = {
  args: {
    deltaFormatted: '+3.000',
    deltaState: 'behind',
    barPct: 1.0,
    bestLapFormatted: '1:33.756',
    hasDelta: true,
  },
};

export const NoBestLap: Story = {
  args: {
    deltaFormatted: '—',
    deltaState: 'neutral',
    barPct: 0,
    bestLapFormatted: '—',
    hasDelta: false,
  },
};

export const NoData: Story = {
  args: {
    deltaFormatted: '—',
    deltaState: 'neutral',
    barPct: 0,
    bestLapFormatted: '—',
    hasDelta: false,
  },
};
