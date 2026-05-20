import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { telemetryStore } from '../../store/iracing/telemetry.store';
import type { SessionFrame } from '../../types/bindings';
import { FlatFlagsWidget } from './FlatFlagsWidget';
import { widgetDecorator } from '../../storybook/widgetDecorator';

const FLAG_BITS = {
  checkered: 0x00000001,
  white: 0x00000002,
  green: 0x00000004,
  yellow: 0x00000008,
  red: 0x00000010,
  blue: 0x00000020,
  debris: 0x00000040,
  black: 0x00010000,
  servicible: 0x00040000,
  repair: 0x00100000,
} as const;

type FlagKey = keyof typeof FLAG_BITS;

interface StoryArgs {
  flags: FlagKey[];
}

const applyArgs = ({ flags }: StoryArgs) => {
  let sessionBits = 0;
  let playerBits = 0;

  for (const flag of flags) {
    if (flag === 'black') {
      playerBits |= FLAG_BITS.black;
    } else {
      sessionBits |= FLAG_BITS[flag];
    }
  }

  if (flags.includes('servicible' as FlagKey)) {
    sessionBits |= FLAG_BITS.servicible | FLAG_BITS.repair;
  }

  runInAction(() => {
    telemetryStore.updateSession({
      session_flags: sessionBits,
      player_car_flags: playerBits,
    } as SessionFrame);
  });
};

const StoryHost = (args: StoryArgs) => {
  useEffect(() => {
    applyArgs(args);
  }, [args]);
  return <FlatFlagsWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/FlatFlagsWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ width: 300 })],
  args: { flags: [] },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const NoFlags: Story = {};

export const SingleGreen: Story = {
  args: { flags: ['green'] },
};

export const MultipleFlags: Story = {
  args: { flags: ['yellow', 'debris'] },
};

export const AllFlags: Story = {
  args: {
    flags: [
      'green',
      'yellow',
      'red',
      'blue',
      'white',
      'checkered',
      'black',
      'debris',
    ],
  },
};
