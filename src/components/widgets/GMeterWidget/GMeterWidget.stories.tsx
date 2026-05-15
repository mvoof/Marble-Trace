import type { Meta, StoryObj } from '@storybook/react-vite';
import { GMeterWidget } from './GMeterWidget';
import { widgetDecorator } from '../../../stories/widgetDecorator';

const meta: Meta<typeof GMeterWidget> = {
  title: 'Widgets/GMeter',
  component: GMeterWidget,
  parameters: { layout: 'centered' },
  decorators: [
    widgetDecorator({
      width: 240,
      height: 280,
      background: 'radial-gradient(circle, #252525 0%, #14141b 100%)',
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof GMeterWidget>;

export const Default: Story = {
  args: {
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
  },
};

export const TrailMono: Story = {
  args: {
    displayMode: 'trail',
    scale: 3,
    colorMode: 'mono',
  },
};

export const PeakSimple: Story = {
  args: {
    displayMode: 'peak',
    scale: 2,
    colorMode: 'simple',
  },
};
