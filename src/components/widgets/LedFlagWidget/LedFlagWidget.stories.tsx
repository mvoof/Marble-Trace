import type { Meta, StoryObj } from '@storybook/react-vite';

import { LedFlagWidget } from './LedFlagWidget';

const DESIGN_SIZE = 160;

const meta: Meta<typeof LedFlagWidget> = {
  title: 'Widgets/LedFlagWidget',
  component: LedFlagWidget,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={{
          width: DESIGN_SIZE,
          height: DESIGN_SIZE,
          background: '#111',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    flag: 'none',
    blinkOn: true,
  },
};

export default meta;
type Story = StoryObj<typeof LedFlagWidget>;

export const NoFlag: Story = {};

export const GreenFlag: Story = {
  args: { flag: 'green', blinkOn: true },
};

export const YellowFlag: Story = {
  args: { flag: 'yellow', blinkOn: true },
};

export const RedFlag: Story = {
  args: { flag: 'red', blinkOn: true },
};

export const BlueFlag: Story = {
  args: { flag: 'blue', blinkOn: true },
};

export const WhiteFlag: Story = {
  args: { flag: 'white', blinkOn: true },
};

export const CheckeredFlag: Story = {
  args: { flag: 'checkered', blinkOn: true },
};

export const BlackFlag: Story = {
  args: { flag: 'black', blinkOn: true },
};

export const MeatballFlag: Story = {
  args: { flag: 'meatball', blinkOn: true },
};

export const DebrisFlag: Story = {
  args: { flag: 'debris', blinkOn: true },
};

export const YellowBlinkOff: Story = {
  args: { flag: 'yellow', blinkOn: false },
};
