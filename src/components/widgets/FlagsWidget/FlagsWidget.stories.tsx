import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlagsWidget } from './FlagsWidget';
import type { FlagType, FlagsWidgetSettings } from './types';

const DEFAULT_SETTINGS: FlagsWidgetSettings = {
  variant: 'overlay',
  cutoutWidth: 6,
  cutoutHeight: 1,
};

interface FlagsWidgetStoryArgs {
  flag: FlagType;
  blinkOn: boolean;
  blocksX: number;
  blocksY: number;
  variant: FlagsWidgetSettings['variant'];
  cutoutWidth: number;
  cutoutHeight: number;
}

const FlagsWidgetStory = ({
  flag,
  blinkOn,
  blocksX,
  blocksY,
  variant,
  cutoutWidth,
  cutoutHeight,
}: FlagsWidgetStoryArgs) => (
  <div style={{ background: '#050507', padding: 16, display: 'inline-block' }}>
    <FlagsWidget
      flag={flag}
      blinkOn={blinkOn}
      blocksX={blocksX}
      blocksY={blocksY}
      settings={{ variant, cutoutWidth, cutoutHeight }}
    />
  </div>
);

const meta: Meta<FlagsWidgetStoryArgs> = {
  title: 'Widgets/FlagsWidget',
  component: FlagsWidgetStory,
  parameters: { layout: 'centered' },
  args: {
    flag: 'none',
    blinkOn: true,
    blocksX: 10,
    blocksY: 3,
    ...DEFAULT_SETTINGS,
  },
};

export default meta;

type Story = StoryObj<FlagsWidgetStoryArgs>;

export const None: Story = { args: { flag: 'none' } };

export const Green: Story = { args: { flag: 'green' } };

export const Yellow: Story = { args: { flag: 'yellow' } };

export const YellowBlink: Story = { args: { flag: 'yellow', blinkOn: false } };

export const Red: Story = { args: { flag: 'red' } };

export const Blue: Story = { args: { flag: 'blue' } };

export const White: Story = { args: { flag: 'white' } };

export const Checkered: Story = { args: { flag: 'checkered' } };

export const Black: Story = { args: { flag: 'black' } };

export const Meatball: Story = { args: { flag: 'meatball' } };

export const Debris: Story = { args: { flag: 'debris' } };

export const OverlayVariant: Story = {
  args: { flag: 'green', variant: 'overlay', cutoutWidth: 6, cutoutHeight: 1 },
};

export const UnderMirrorVariant: Story = {
  args: {
    flag: 'yellow',
    variant: 'under-mirror',
    blocksX: 10,
    blocksY: 1,
  },
};

export const StandaloneVariant: Story = {
  args: {
    flag: 'red',
    variant: 'standalone',
    blocksX: 3,
    blocksY: 3,
  },
};

export const NoCutout: Story = {
  args: {
    flag: 'meatball',
    variant: 'overlay',
    cutoutWidth: 0,
    cutoutHeight: 0,
  },
};

export const DeepCutout: Story = {
  args: {
    flag: 'meatball',
    variant: 'overlay',
    cutoutWidth: 6,
    cutoutHeight: 2,
  },
};
